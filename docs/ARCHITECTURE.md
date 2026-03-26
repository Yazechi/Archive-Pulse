# Architecture

## Overview

Archive Pulse uses a split frontend/backend architecture:

- backend at repo root
- frontend in `frontend/`
- shared runtime media and database state on disk

## Backend flow

The backend handles:

- API routes
- uploads
- local media serving
- YouTube-backed audio streams
- manga search and chapter download
- metadata persistence

Key files:

- [`server.js`](../server.js)
- [`database/schema.sql`](../database/schema.sql)

## Frontend flow

The frontend handles:

- app shell and routes
- player state
- mini player and main player
- reader screens
- visualizer settings and rendering

Key files:

- [`frontend/src/App.jsx`](../frontend/src/App.jsx)
- [`frontend/src/context/MusicContext.jsx`](../frontend/src/context/MusicContext.jsx)
- [`frontend/src/components/MainPlayer.jsx`](../frontend/src/components/MainPlayer.jsx)
- [`frontend/src/components/Player.jsx`](../frontend/src/components/Player.jsx)
- [`frontend/src/components/visualizers/Spectrum3DCanvas.jsx`](../frontend/src/components/visualizers/Spectrum3DCanvas.jsx)

## Manga provider notes

The backend currently uses:

- MangaDex for manga/chapter search and pages
- Jikan / MyAnimeList for fallback information results

This means provider/network behavior can affect search completeness independently of frontend code.

## Books provider

The backend currently uses: 

- OpenLibrary
- Gutenberg for downloading the epubs directly into the website.

