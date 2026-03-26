# Archive Pulse

Archive Pulse is a self-hosted media hub for music, books, manga/comics, uploads, playlists, and a reactive visualizer-driven playback experience. As the name suggest it thrives to be a personal archive, but for now it only provides archiving for music, books, manga/comics. So any new ideas for content to archive are open, you can do a feature request or contribute to the repository.

This repository contains:

- a Node.js / Express backend
- a React + Vite frontend
- a local database schema
- runtime upload storage for music, books, and manga

## What Archive Pulse does

Archive Pulse is built around three primary use cases:

1. Music playback
- local music uploads
- YouTube-backed audio playback
- queue and next/previous flow
- mini player and main player
- a configurable reactive visualizer

2. Reading
- books and light novels
- PDF and EPUB reading
- manga/comic reading
- local chapter archives in `CBZ`

3. Personal media archiving
- uploads
- metadata storage
- search
- playlists
- progress tracking

## Stack

### Backend

- Node.js
- Express
- Multer
- Axios
- `youtube-dl-exec`
- `music-metadata`
- `adm-zip`
- `epub2`

### Frontend

- React
- React Router
- Vite
- Tailwind CSS
- Axios

## Repository structure

```text
.
|-- server.js
|-- package.json
|-- database/
|   |-- schema.sql
|   `-- archive.db
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- CONTRIBUTING.md
|   |-- ISSUE_REPORTING.md
|   `-- USAGE.md
|-- frontend/
|   |-- package.json
|   |-- public/
|   `-- src/
|-- uploads/
`-- README.md
```

## Source model

### Music sources

Archive Pulse currently supports:

- local uploaded music
- YouTube-backed music playback through the backend stream route

### Book and light novel sources

Archive Pulse currently supports:

- local uploaded `EPUB`
- local uploaded `PDF`
- external search/provider metadata from OpenLibrary
- external search/provider metadata from Gutenberg

### Manga and comic sources

Archive Pulse currently supports:

- MangaDex for actual manga discovery, chapter lookup, page access, and chapter download flow
- Jikan / MyAnimeList as a fallback informational provider when MangaDex is not reachable or does not return usable results
- local uploaded `CBZ` archives for manga/comics

This distinction matters:

- MangaDex results are the useful results for reading/downloading chapters through the app
- MyAnimeList/Jikan results may only provide metadata and not the same chapter-access workflow

## Main features

### Music

- local uploads
- YouTube audio streaming
- metadata and thumbnails
- queue support
- playback progress
- mini player and expanded player
- configurable reactive visualizer

### Books and light novels

- local library support
- PDF / EPUB reading
- progress tracking
- grouping / series workflow
- external metadata/search support through OpenLibrary and Gutenberg

### Manga / comics

- MangaDex-backed chapter search
- Jikan / MyAnimeList fallback metadata search
- local manga chapter archives in `CBZ`
- chapter reading from downloaded or uploaded local archives

## Manga and comic notes users must know

Archive Pulse’s manga workflow has some important real-world caveats.

### Search providers

The manga search flow in the backend currently uses:

- MangaDex for actual manga search and chapter access
- Jikan / MyAnimeList as a fallback information source

That means a user may sometimes see:

- MangaDex results when MangaDex is reachable
- only MyAnimeList-style informational results when MangaDex is not reachable from their network

### If MangaDex results do not show up

Some users may not receive MangaDex results directly from their network or ISP routing.

If that happens, the practical workaround is to use a VPN and try again.

Examples:

- ProtonVPN
- Windscribe

This is especially relevant if:

- manga search only returns MyAnimeList/Jikan information entries
- MangaDex-backed chapters are missing
- chapter download flows fail due to upstream access problems

### Manga upload format

Archive Pulse expects local manga/comic chapter archives in:

- `CBZ`

If you want to build a local manga archive for this app, a practical workflow is:

1. Use HakuNeko/nightly
2. Download chapter batches from supported connectors
3. Keep the downloaded manga chapter archives in `CBZ`
4. Upload or place them into Archive Pulse

HakuNeko nightly GitHub repository:

- https://github.com/manga-download/hakuneko

### HakuNeko connector problems

If you cannot access some HakuNeko connectors or sources, the same network limitation may apply there as well.

If that happens:

1. use a VPN
2. retry the connector/source
3. then download your chapter batch again

## Setup

### Prerequisites

- Node.js 18+ recommended
- npm

### Install backend dependencies

```bash
npm install
```

### Install frontend dependencies

```bash
cd frontend
npm install
```

### Run backend

From repo root:

```bash
npm run dev
```

### Run frontend

From `frontend/`:

```bash
npm run dev
```

### Build frontend

From `frontend/`:

```bash
npm run build
```

## Documentation

Start here:

- [Usage Guide](/D:/The%20Archive/docs/USAGE.md)
- [Architecture](/D:/The%20Archive/docs/ARCHITECTURE.md)
- [Contributing](/D:/The%20Archive/docs/CONTRIBUTING.md)
- [Issue Reporting](/D:/The%20Archive/docs/ISSUE_REPORTING.md)

## Git and first commit

Recommended first commit message:

`chore: initialize Archive Pulse with backend, frontend, docs, and gitignore`

Alternative:

`feat: initial Archive Pulse media hub application`

Recommended commands:

```bash
git add .
git status
git commit -m "chore: initialize Archive Pulse with backend, frontend, docs, and gitignore"
```

## What should not be committed

Do not commit:

- `node_modules`
- `frontend/dist`
- `.env`
- `uploads`
- cookies
- local database artifacts you do not want versioned

See:

- [`.gitignore`](/D:/The%20Archive/.gitignore)
- [`frontend/.gitignore`](/D:/The%20Archive/frontend/.gitignore)
