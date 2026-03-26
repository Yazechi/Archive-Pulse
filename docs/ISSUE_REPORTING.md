# Issue Reporting

## Before opening an issue

Check these first:

1. Is this a setup/environment problem?
2. Is this expected provider behavior?
3. Is this a local media/path issue?
4. Is this already documented in the repo?

Relevant docs:

- [README](../README.md)
- [Usage Guide](./USAGE.md)
- [Architecture](./ARCHITECTURE.md)

## Important known cases

### MangaDex not showing results

This may be a network/provider access issue rather than an Archive Pulse bug.

If MangaDex results do not appear but MyAnimeList/Jikan results do, try a VPN first.

Examples:

- ProtonVPN
- Windscribe

### HakuNeko connector failures

If HakuNeko cannot access some sources/connectors, try a VPN first.

This may be the same network/access issue affecting MangaDex in Archive Pulse.

### Informational manga results only

If search returns only MyAnimeList/Jikan-style informational results, that usually means MangaDex was not reachable or did not provide usable matches from your current network path.

## What to include in a good issue

- what you tried to do
- what you expected
- what actually happened
- reproduction steps
- screenshots if UI-related
- console error or backend log if available
- OS / browser / Node.js version
- whether a VPN changes the outcome
- whether the item is local, YouTube-backed, MangaDex-backed, OpenLibrary, or Gutenberg-related

## When opening a provider issue

Be explicit about the source involved:

- music: local or YouTube-backed
- books: local `EPUB` / `PDF`, OpenLibrary, or Gutenberg
- manga: MangaDex or Jikan / MyAnimeList fallback

