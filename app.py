import os
import re
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request


load_dotenv()

API_BASE = "https://www.googleapis.com/youtube/v3"
CHANNEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{10,64}$")
app = Flask(__name__)


class YouTubeAPIError(Exception):
    def __init__(self, message: str, reason: str = "", status: int | None = None):
        super().__init__(message)
        self.reason = reason
        self.status = status


def get_api_key() -> str:
    return os.environ.get("YOUTUBE_API_KEY", "").strip()


def youtube_get(endpoint: str, **params: Any) -> dict[str, Any]:
    api_key = get_api_key()
    if not api_key:
        raise YouTubeAPIError(
            "The YouTube API key is not configured. Add YOUTUBE_API_KEY to your .env file.",
            "missingApiKey",
        )

    try:
        response = requests.get(
            f"{API_BASE}/{endpoint}",
            params={"key": api_key, **params},
            timeout=20,
        )
    except requests.RequestException as exc:
        raise YouTubeAPIError(
            "Could not connect to YouTube. Check your internet connection and try again."
        ) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise YouTubeAPIError("YouTube returned an unreadable response.") from exc

    if not response.ok:
        error = payload.get("error", {})
        details = error.get("errors", [])
        reason = details[0].get("reason", "") if details else ""
        raise YouTubeAPIError(
            error.get("message", "The YouTube API request failed."),
            reason,
            response.status_code,
        )
    return payload


def friendly_error(error: YouTubeAPIError) -> tuple[str, int]:
    if error.reason == "missingApiKey":
        return str(error), 503
    if error.reason in {"quotaExceeded", "dailyLimitExceeded"}:
        return (
            "The YouTube API quota has been reached. Try again later or check the quota in Google Cloud Console.",
            429,
        )
    if error.reason in {"keyInvalid", "ipRefererBlocked", "accountNotConfigured"}:
        return (
            "The API key is invalid or not permitted to make this request. Check the key and its API restrictions.",
            503,
        )
    if error.reason == "accessNotConfigured":
        return (
            "YouTube Data API v3 is not enabled for this Google Cloud project.",
            503,
        )
    if error.status == 403:
        return (
            "YouTube denied this request. Check the API key and YouTube Data API access.",
            403,
        )
    if error.status == 404:
        return "The requested channel could not be found.", 404
    if error.status == 400:
        return "YouTube could not understand the request. Check the search or channel ID.", 400
    return str(error), 502


def thumbnail_url(thumbnails: dict[str, Any]) -> str | None:
    for size in ("maxres", "standard", "high", "medium", "default"):
        image = thumbnails.get(size)
        if image and image.get("url"):
            return image["url"]
    return None


def banner_url(channel: dict[str, Any]) -> str | None:
    url = (
        channel.get("brandingSettings", {})
        .get("image", {})
        .get("bannerExternalUrl")
    )
    if not url:
        return None
    if re.search(r"=(?:w|s)\d+", url):
        return re.sub(r"=(?:w|s)\d+", "=w2560", url, count=1)
    return f"{url}=w2560"


def get_upload_page(
    uploads_id: str, page_token: str | None = None
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "part": "snippet,contentDetails",
        "playlistId": uploads_id,
        "maxResults": 9,
    }
    if page_token:
        params["pageToken"] = page_token
    playlist = youtube_get("playlistItems", **params)
    video_ids = [
        item.get("contentDetails", {}).get("videoId")
        for item in playlist.get("items", [])
        if item.get("contentDetails", {}).get("videoId")
    ]

    video_by_id = {}
    if video_ids:
        video_response = youtube_get(
            "videos",
            part="snippet,statistics",
            id=",".join(video_ids),
        )
        video_by_id = {
            video["id"]: video
            for video in video_response.get("items", [])
            if video.get("id")
        }

    videos = []
    for video_id in video_ids:
        video = video_by_id.get(video_id)
        if not video:
            continue
        snippet = video.get("snippet", {})
        videos.append(
            {
                "id": video_id,
                "title": snippet.get("title", "Untitled video"),
                "thumbnail": thumbnail_url(snippet.get("thumbnails", {})),
                "publishedAt": snippet.get("publishedAt", ""),
                "viewCount": video.get("statistics", {}).get("viewCount"),
            }
        )

    return {
        "videos": videos,
        "nextPageToken": playlist.get("nextPageToken"),
    }


def search_channels(query: str) -> list[dict[str, Any]]:
    result = youtube_get(
        "search",
        part="snippet",
        type="channel",
        q=query,
        maxResults=6,
    )
    channels = []
    for item in result.get("items", []):
        snippet = item.get("snippet", {})
        channel_id = item.get("id", {}).get("channelId")
        if not channel_id:
            continue
        channels.append(
            {
                "id": channel_id,
                "title": snippet.get("title", "Untitled channel"),
                "description": snippet.get("description", ""),
                "customUrl": snippet.get("customUrl", ""),
                "thumbnail": thumbnail_url(snippet.get("thumbnails", {})),
            }
        )
    return channels


def get_channel_dashboard(channel_id: str) -> dict[str, Any] | None:
    response = youtube_get(
        "channels",
        part="snippet,statistics,brandingSettings,contentDetails",
        id=channel_id,
    )
    channels = response.get("items", [])
    if not channels:
        return None

    channel = channels[0]
    snippet = channel.get("snippet", {})
    uploads_id = (
        channel.get("contentDetails", {})
        .get("relatedPlaylists", {})
        .get("uploads")
    )
    upload_page = get_upload_page(uploads_id) if uploads_id else {
        "videos": [],
        "nextPageToken": None,
    }

    statistics = channel.get("statistics", {})
    return {
        "id": channel_id,
        "title": snippet.get("title", "YouTube channel"),
        "description": snippet.get("description", ""),
        "customUrl": snippet.get("customUrl", ""),
        "thumbnail": thumbnail_url(snippet.get("thumbnails", {})),
        "banner": banner_url(channel),
        "subscriberCount": (
            None
            if statistics.get("hiddenSubscriberCount")
            else statistics.get("subscriberCount")
        ),
        "viewCount": statistics.get("viewCount"),
        "videoCount": statistics.get("videoCount"),
        **upload_page,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/search")
def api_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Enter a channel name to search."}), 400
    if len(query) > 100:
        return jsonify({"error": "Search text must be 100 characters or fewer."}), 400
    try:
        channels = search_channels(query)
    except YouTubeAPIError as error:
        message, status = friendly_error(error)
        return jsonify({"error": message}), status
    return jsonify({"channels": channels})


@app.get("/api/channels/<channel_id>")
def api_channel(channel_id: str):
    if not CHANNEL_ID_PATTERN.fullmatch(channel_id):
        return jsonify({"error": "The channel ID is invalid."}), 400
    try:
        channel = get_channel_dashboard(channel_id)
    except YouTubeAPIError as error:
        message, status = friendly_error(error)
        return jsonify({"error": message}), status
    if channel is None:
        return jsonify({"error": "The selected channel could not be found."}), 404
    return jsonify({"channel": channel})


@app.get("/api/channels/<channel_id>/videos")
def api_channel_videos(channel_id: str):
    if not CHANNEL_ID_PATTERN.fullmatch(channel_id):
        return jsonify({"error": "The channel ID is invalid."}), 400
    page_token = request.args.get("pageToken", "").strip()
    if len(page_token) > 1024:
        return jsonify({"error": "The uploads page token is invalid."}), 400
    try:
        response = youtube_get(
            "channels",
            part="contentDetails",
            id=channel_id,
        )
        channels = response.get("items", [])
        if not channels:
            return jsonify({"error": "The selected channel could not be found."}), 404
        uploads_id = (
            channels[0]
            .get("contentDetails", {})
            .get("relatedPlaylists", {})
            .get("uploads")
        )
        if not uploads_id:
            return jsonify({"videos": [], "nextPageToken": None})
        page = get_upload_page(uploads_id, page_token or None)
    except YouTubeAPIError as error:
        message, status = friendly_error(error)
        return jsonify({"error": message}), status
    return jsonify(page)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
