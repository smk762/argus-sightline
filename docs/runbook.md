# Runbook: checking a change and recording the demo

Moved out of CLAUDE.md (argus-sightline#32). The rules these steps protect are in CLAUDE.md's "Must never
happen" table; this file says how to run things.

## Checking a change

`make check` and `make build`, then `make up` and drive it in headless Chrome:
`zenika/alpine-chrome:with-puppeteer` with `--network host --use-angle=swiftshader --enable-unsafe-swiftshader`.
Both the map and the point view render under swiftshader. Click steps by button text and wait for the
`.sweep` progress bar to disappear. Watch for `securitypolicyviolation` events: the CSP is strict.

## Recording the hosted demo's tape

`make tape-data` (public USGS 3DEP lidar, see `public/data-tape/PROVENANCE.md`), `make up` on the pinned
survey commit, then `make tape` (`scripts/record-tape.mjs`). It runs on CPU in under a minute. Re-record
whenever the survey pin moves. Only public data goes on the tape: `src/lib/tapeProvenance.test.ts` holds
the allowlist of datasets, and a new one needs a public source, a redistributable licence and a
PROVENANCE.md entry.

## Browser check of the hosted demo

`make pages && PLAYWRIGHT_DIR=… node scripts/demo-e2e.mjs out [shots]` at 1440 and 390, light and dark. It
fails on any console error, failed request or CSP violation.
