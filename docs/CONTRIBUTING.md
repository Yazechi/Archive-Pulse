# Contributing

## Before opening a PR

Read these first:

- [README](../README.md)
- [Architecture](./ARCHITECTURE.md)
- [Usage Guide](./USAGE.md)
- [Issue Reporting](./ISSUE_REPORTING.md)

## Setup

### Backend

```bash
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Contribution priorities

Good contributions include:

- bug fixes
- UX improvements
- performance improvements
- visualizer improvements
- adding more source for the books and mangas
- new features
- backend route cleanup
- documentation

## Sources and provider expectations

Before changing provider logic, understand the current model:

- music can be local or YouTube-backed
- books/light novels can be local `EPUB` / `PDF` with OpenLibrary and Gutenberg used for search/metadata workflows
- manga/comics rely on MangaDex for practical chapter access, with Jikan / MyAnimeList as a fallback informational source

If you change these behaviors, update the documentation in the same PR.

## Do not commit

- `node_modules`
- build output
- `.env`
- uploaded private media
- cookies
- accidental local database dumps

## Code expectations

- keep changes focused
- preserve working features unless a change explicitly fixes them
- avoid introducing new runtime crashes
- build the frontend before finalizing UI changes
- document user-facing behavior changes
- if provider behavior changes, update README and usage docs

## Commit style

Recommended prefixes:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`

## Issues and pull requests

If you fix a bug that users commonly hit, include:

- reproduction steps
- root cause summary
- validation performed
- docs update if the behavior is provider-specific or environment-specific

