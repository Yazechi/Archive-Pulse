# Usage Guide

## Overview

Archive Pulse is a local-first personal media app with music playback, books, manga/comics, uploads, playlists, and a reactive visualizer.

## Running the app

### Backend

From repository root:

```bash
npm run dev
```

### Frontend

From `frontend/`:

```bash
npm run dev
```

## Music

### Supported music flows

- play local uploaded music
- play YouTube-backed tracks
- use the queue
- skip forward/backward
- use mini player or main player
- adjust the visualizer

### Music source notes

Archive Pulse currently plays:

- local uploaded music files
- YouTube-backed streams through the backend

### If YouTube-backed playback fails

Common causes:

- upstream access/network interruptions
- `yt-dlp` process interruption during refresh or track switching
- missing or invalid cookies if the source requires them

## Books and light novels

### Current local formats

- `EPUB`
- `PDF`

### External provider/search notes

Archive Pulse also uses:

- OpenLibrary
- Gutenberg

These sources are useful for discovery and metadata. Reading inside the app still depends on a local supported file or a locally managed library item.

### Reading behavior

- progress is tracked
- reader mode depends on the content type
- series/grouping features are available in the library UI

## Manga and comics

### Current source flow

Archive Pulse currently uses:

- MangaDex for manga/chapter search and chapter page access
- Jikan / MyAnimeList as a fallback metadata source

### Important MangaDex note

Some users may not see MangaDex-backed search results depending on network restrictions or routing.

If you see only MyAnimeList/Jikan-style information results and not MangaDex-backed results, try a VPN.

Examples:

- ProtonVPN
- Windscribe

### What the fallback means

If MangaDex is unavailable, search may still return MyAnimeList/Jikan items. Those can be useful for information, but they do not always provide the same read/download workflow as MangaDex-backed entries.

### Local manga/comic format

Archive Pulse expects local manga chapter archives in:

- `CBZ`

### Recommended manga acquisition workflow

One practical workflow is:

1. use HakuNeko/nightly
2. download manga chapters in batch
3. keep/export them in `CBZ`
4. upload or place them into Archive Pulse

HakuNeko/nightly repository:

- https://github.com/manga-download/hakuneko

### If HakuNeko connectors fail

If HakuNeko cannot access some connectors/providers:

1. use a VPN
2. retry the connector
3. download again

The same connectivity issue can affect MangaDex access inside Archive Pulse.

## Uploads

### Music uploads

Use the upload flow for local music files.

### Book uploads

Use:

- `EPUB`
- `PDF`

### Manga uploads

Use:

- `CBZ`

## Search behavior

### Manga search

Search may return:

- MangaDex-backed items
- MyAnimeList/Jikan informational items if MangaDex is unavailable

This is expected behavior given the current provider setup.
