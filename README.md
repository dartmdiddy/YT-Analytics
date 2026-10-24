# YouTube Channel Analytics

A small responsive website for searching YouTube channels and exploring public channel statistics and recent uploads. The Flask server resolves channel names with YouTube Data API v3 and keeps the API key on the server; it is never sent to the browser. No user accounts are required.

## Requirements

- Python 3.10 or newer
- A Google Cloud project with **YouTube Data API v3** enabled
- An API key for that project

## Configure the API key

Create or select a project in [Google Cloud Console](https://console.cloud.google.com/), enable **YouTube Data API v3**, and create an API key under **APIs & Services → Credentials**. Restrict the key to the YouTube Data API v3 where practical.

Add the key to a `.env` file in the project directory:

```dotenv
YOUTUBE_API_KEY=your-api-key
```

Alternatively, set `YOUTUBE_API_KEY` as an environment variable before starting the server. Do not commit the key or share it publicly.

## Run locally on Windows

From the project directory in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000** in the browser. In VS Code, open the URL in the integrated/shared browser if available. Stop the server with `Ctrl+C`.

## Features

- Search channel names and select the matching result.
- View the channel profile, banner, description, public subscriber count, views, and video count.
- Compare current view counts across uploads in an expandable bar chart; collapse it to the latest 9 videos with **Show less**.
- Browse uploads in batches of 9 with high-resolution thumbnails and individual view counts. Click a thumbnail to open the video on YouTube, and use **Show more videos** to fetch the next batch.
- Filter loaded videos, sort by upload date or views, and copy a link that opens the selected channel.
- Error messages cover missing/invalid API keys, disabled API access, quota limits, and empty search results.

Subscriber counts can be hidden by the channel owner. The application displays public data only.
The chart compares current public view totals for recent uploads; it does not show historical growth. Historical channel analytics require the channel owner's authorization.
