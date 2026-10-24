const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#channel-query");
const searchButton = document.querySelector("#search-button");
const resultsSection = document.querySelector("#search-results");
const channelList = document.querySelector("#channel-list");
const resultsCount = document.querySelector("#results-count");
const dashboard = document.querySelector("#dashboard");
const feedback = document.querySelector("#feedback");

function showMessage(message) {
  feedback.textContent = message;
  feedback.hidden = !message;
}

function clearMessage() {
  showMessage("");
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Something went wrong. Please try again.");
  }
  return payload;
}

function imageElement(url, className, alt) {
  const image = document.createElement("img");
  image.className = className;
  image.alt = alt;
  image.loading = "lazy";
  if (url) image.src = url;
  return image;
}

function setVideoThumbnail(image, video) {
  const videoId = encodeURIComponent(video.id);
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    video.thumbnail,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ].filter((url, index, urls) => url && urls.indexOf(url) === index);

  let index = 0;
  const tryNext = () => {
    if (index >= candidates.length) {
      image.removeAttribute("src");
      return;
    }
    image.src = candidates[index];
  };
  image.addEventListener("error", () => {
    index += 1;
    tryNext();
  });
  image.addEventListener("load", () => {
    if (index < 3 && image.naturalWidth < 640) {
      index += 1;
      tryNext();
    }
  });
  tryNext();
}

function renderResults(channels) {
  channelList.replaceChildren();
  resultsCount.textContent = `${channels.length} ${channels.length === 1 ? "channel" : "channels"}`;
  channels.forEach((channel) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "channel-option";
    button.append(imageElement(channel.thumbnail, "channel-avatar", ""));

    const copy = document.createElement("span");
    copy.className = "channel-option-copy";
    const title = document.createElement("span");
    title.className = "channel-option-title";
    title.textContent = channel.title;
    copy.append(title);

    if (channel.customUrl) {
      const handle = document.createElement("span");
      handle.className = "channel-option-url";
      handle.textContent = channel.customUrl;
      copy.append(handle);
    }
    const description = document.createElement("span");
    description.className = "channel-option-description";
    description.textContent = channel.description || "No description available.";
    copy.append(description);
    button.append(copy);
    button.addEventListener("click", () => loadDashboard(channel.id));
    channelList.append(button);
  });
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatCount(value) {
  if (value === null || value === undefined || value === "") return "Hidden";
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat().format(number) : "—";
}

function addMetric(container, label, value) {
  const card = document.createElement("div");
  card.className = "metric-card";
  const name = document.createElement("span");
  name.className = "metric-label";
  name.textContent = label;
  const count = document.createElement("strong");
  count.className = "metric-value";
  count.textContent = value;
  card.append(name, count);
  container.append(card);
}

function renderViewsChart(videos, expanded = true) {
  const section = document.createElement("section");
  section.className = "views-chart";
  section.setAttribute("aria-labelledby", "views-chart-title");
  section.dataset.expanded = String(expanded);

  const heading = document.createElement("div");
  heading.className = "chart-heading";
  const title = document.createElement("h3");
  title.id = "views-chart-title";
  title.textContent = "Views by recent upload";
  const note = document.createElement("p");
  note.textContent = "Current total views · latest videos first";
  const headingCopy = document.createElement("div");
  headingCopy.append(title, note);
  heading.append(headingCopy);
  if (videos.length > 9) {
    const toggle = document.createElement("button");
    toggle.className = "chart-toggle-button";
    toggle.type = "button";
    toggle.textContent = expanded ? "Show less" : `Show all ${videos.length} videos`;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.addEventListener("click", () => {
      section.replaceWith(renderViewsChart(videos, !expanded));
    });
    heading.append(toggle);
  }
  section.append(heading);

  const visibleVideos = expanded ? videos : videos.slice(0, 9);
  const values = visibleVideos.map((video) => {
    const parsed = Number(video.viewCount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const maximum = Math.max(...values, 1);
  const rows = document.createElement("div");
  rows.className = "chart-rows";

  visibleVideos.forEach((video, index) => {
    const row = document.createElement("div");
    row.className = "chart-row";

    const label = document.createElement("span");
    label.className = "chart-video-title";
    label.textContent = video.title;
    label.title = video.title;

    const track = document.createElement("div");
    track.className = "chart-track";
    track.setAttribute("role", "img");
    track.setAttribute(
      "aria-label",
      `${video.title}: ${formatCount(video.viewCount)} views`,
    );
    const bar = document.createElement("span");
    bar.className = "chart-bar";
    bar.style.width = `${(values[index] / maximum) * 100}%`;
    track.append(bar);

    const count = document.createElement("span");
    count.className = "chart-count";
    count.textContent = formatCount(video.viewCount);
    row.append(label, track, count);
    rows.append(row);
  });

  section.append(rows);
  return section;
}

function appendVideoCards(videos, grid) {
  videos.forEach((video, index) => {
    const card = document.createElement("article");
    card.className = "video-card video-card-enter";
    card.style.animationDelay = `${Math.min(index % 8, 7) * 55}ms`;
    card.dataset.title = video.title.toLocaleLowerCase();
    card.dataset.views = String(Number(video.viewCount) || 0);
    card.dataset.published = String(Date.parse(video.publishedAt) || 0);
    card.dataset.videoId = video.id;

    const preview = document.createElement("a");
    preview.className = "video-preview";
    preview.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    preview.target = "_blank";
    preview.rel = "noopener noreferrer";
    preview.setAttribute("aria-label", `Watch ${video.title} on YouTube`);
    const thumbnail = imageElement(null, "video-thumbnail", "");
    setVideoThumbnail(thumbnail, video);
    preview.append(thumbnail);
    const playIcon = document.createElement("span");
    playIcon.className = "video-play-icon";
    playIcon.setAttribute("aria-hidden", "true");
    playIcon.textContent = "▶";
    preview.append(playIcon);
    card.append(preview);

    const copy = document.createElement("div");
    copy.className = "video-copy";
    const title = document.createElement("div");
    title.className = "video-title";
    title.textContent = video.title;
    const views = document.createElement("div");
    views.className = "video-views";
    views.textContent = `${formatCount(video.viewCount)} views`;
    const watchLink = document.createElement("a");
    watchLink.className = "video-watch-link";
    watchLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    watchLink.target = "_blank";
    watchLink.rel = "noopener noreferrer";
    watchLink.textContent = "Watch on YouTube ↗";
    copy.append(title, views, watchLink);
    card.append(copy);
    grid.append(card);
  });
}

function updateVideoDisplay(grid, filterInput, sortSelect, countLabel) {
  const cards = Array.from(grid.children);
  const query = filterInput.value.trim().toLocaleLowerCase();
  const sortBy = sortSelect.value;

  cards.forEach((card) => {
    card.hidden = query !== "" && !card.dataset.title.includes(query);
  });
  cards.sort((left, right) => {
    if (sortBy === "views") {
      return Number(right.dataset.views) - Number(left.dataset.views);
    }
    if (sortBy === "oldest") {
      return Number(left.dataset.published) - Number(right.dataset.published);
    }
    return Number(right.dataset.published) - Number(left.dataset.published);
  });
  cards.forEach((card) => grid.append(card));
  const visible = cards.filter((card) => !card.hidden).length;
  countLabel.textContent = `Showing ${visible} of ${cards.length} loaded`;
}

async function loadMoreVideos(channel, grid, button) {
  if (!channel.nextPageToken || button.disabled) return;

  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Loading more videos…";
  clearMessage();
  try {
    const url = new URL(
      `/api/channels/${encodeURIComponent(channel.id)}/videos`,
      window.location.origin,
    );
    url.searchParams.set("pageToken", channel.nextPageToken);
    const page = await getJson(url);
    channel.videos.push(...page.videos);
    channel.nextPageToken = page.nextPageToken;
    appendVideoCards(page.videos, grid);
    updateVideoDisplay(
      grid,
      dashboard.querySelector(".video-filter"),
      dashboard.querySelector(".video-sort"),
      dashboard.querySelector(".video-count"),
    );
    const currentChart = dashboard.querySelector(".views-chart");
    const chartExpanded = currentChart?.dataset.expanded !== "false";
    currentChart?.replaceWith(renderViewsChart(channel.videos, chartExpanded));
    button.hidden = !channel.nextPageToken;
  } catch (error) {
    showMessage(error.message);
    button.textContent = "Try again";
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (!button.hidden && button.textContent !== "Try again") {
      button.textContent = "Show more videos";
    }
  }
}

function renderDashboard(channel) {
  dashboard.replaceChildren();

  if (channel.banner) {
    dashboard.append(imageElement(channel.banner, "channel-banner", `${channel.title} channel banner`));
  }

  const heading = document.createElement("div");
  heading.className = "channel-heading";
  heading.append(imageElement(channel.thumbnail, "channel-avatar", `${channel.title} profile picture`));
  const identity = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = channel.title;
  identity.append(title);
  if (channel.customUrl) {
    const handle = document.createElement("span");
    handle.className = "channel-handle";
    handle.textContent = channel.customUrl;
    identity.append(handle);
  }
  heading.append(identity);
  const shareButton = document.createElement("button");
  shareButton.className = "share-channel-button";
  shareButton.type = "button";
  shareButton.textContent = "Copy channel link";
  shareButton.addEventListener("click", async () => {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("channel", channel.id);
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      shareButton.textContent = "Link copied!";
      window.setTimeout(() => {
        shareButton.textContent = "Copy channel link";
      }, 1800);
    } catch (error) {
      showMessage("Could not copy the link. Check clipboard permissions and try again.");
    }
  });
  heading.append(shareButton);
  dashboard.append(heading);

  const description = document.createElement("p");
  description.className = "channel-description";
  description.textContent = channel.description || "No channel description available.";
  dashboard.append(description);

  const metrics = document.createElement("div");
  metrics.className = "metrics";
  addMetric(metrics, "Subscribers", formatCount(channel.subscriberCount));
  addMetric(metrics, "Total views", formatCount(channel.viewCount));
  addMetric(metrics, "Videos", formatCount(channel.videoCount));
  dashboard.append(metrics);

  if (channel.videos.length) {
    dashboard.append(renderViewsChart(channel.videos));
  }

  const uploadsHeader = document.createElement("div");
  uploadsHeader.className = "uploads-heading";
  const uploadsTitle = document.createElement("h3");
  uploadsTitle.textContent = "Recent uploads";
  const uploadsNote = document.createElement("span");
  uploadsNote.textContent = "Latest videos from this channel";
  uploadsHeader.append(uploadsTitle, uploadsNote);
  dashboard.append(uploadsHeader);

  if (!channel.videos.length) {
    const empty = document.createElement("p");
    empty.className = "empty-uploads";
    empty.textContent = "No recent uploads were found for this channel.";
    dashboard.append(empty);
  } else {
    const controls = document.createElement("div");
    controls.className = "video-controls";
    const filterInput = document.createElement("input");
    filterInput.className = "video-filter";
    filterInput.type = "search";
    filterInput.placeholder = "Filter loaded videos…";
    filterInput.setAttribute("aria-label", "Filter loaded videos");
    const sortSelect = document.createElement("select");
    sortSelect.className = "video-sort";
    sortSelect.setAttribute("aria-label", "Sort videos");
    [
      ["newest", "Newest first"],
      ["views", "Most viewed"],
      ["oldest", "Oldest first"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sortSelect.append(option);
    });
    const countLabel = document.createElement("span");
    countLabel.className = "video-count";
    controls.append(filterInput, sortSelect, countLabel);
    dashboard.append(controls);

    const grid = document.createElement("div");
    grid.className = "video-grid";
    appendVideoCards(channel.videos, grid);
    dashboard.append(grid);
    filterInput.addEventListener("input", () =>
      updateVideoDisplay(grid, filterInput, sortSelect, countLabel),
    );
    sortSelect.addEventListener("change", () =>
      updateVideoDisplay(grid, filterInput, sortSelect, countLabel),
    );
    updateVideoDisplay(grid, filterInput, sortSelect, countLabel);
    const moreButton = document.createElement("button");
    moreButton.className = "show-more-button";
    moreButton.type = "button";
    moreButton.textContent = "Show more videos";
    moreButton.hidden = !channel.nextPageToken;
    moreButton.addEventListener("click", () =>
      loadMoreVideos(channel, grid, moreButton),
    );
    dashboard.append(moreButton);
  }

  dashboard.hidden = false;
  dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    showMessage("Enter a channel name to search.");
    searchInput.focus();
    return;
  }
  clearMessage();
  const searchUrl = new URL(window.location.href);
  searchUrl.searchParams.delete("channel");
  window.history.replaceState({}, "", searchUrl);
  dashboard.hidden = true;
  resultsSection.hidden = true;
  channelList.replaceChildren();
  searchButton.disabled = true;
  searchButton.querySelector("span:first-child").textContent = "Searching…";
  try {
    const payload = await getJson(`/api/search?q=${encodeURIComponent(query)}`);
    if (!payload.channels.length) {
      showMessage("No channels found. Try another name or spelling.");
      return;
    }
    renderResults(payload.channels);
  } catch (error) {
    showMessage(error.message);
  } finally {
    searchButton.disabled = false;
    searchButton.querySelector("span:first-child").textContent = "Search";
  }
});

async function loadDashboard(channelId) {
  clearMessage();
  dashboard.hidden = true;
  dashboard.innerHTML = "";
  dashboard.insertAdjacentHTML("afterbegin", '<p class="empty-uploads">Loading channel analytics…</p>');
  dashboard.hidden = false;
  dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const payload = await getJson(`/api/channels/${encodeURIComponent(channelId)}`);
    const channelUrl = new URL(window.location.href);
    channelUrl.searchParams.set("channel", channelId);
    window.history.replaceState({}, "", channelUrl);
    renderDashboard(payload.channel);
  } catch (error) {
    dashboard.hidden = true;
    showMessage(error.message);
  }
}

const sharedChannelId = new URLSearchParams(window.location.search).get("channel");
if (sharedChannelId && /^[A-Za-z0-9_-]{10,64}$/.test(sharedChannelId)) {
  loadDashboard(sharedChannelId);
}
