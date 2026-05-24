# Flight Points (PWA)

A mobile-first aviation-themed habit and reward tracker for kids.

## Setup
1. Install dependencies: `npm install`
2. Run locally: `npm run dev`

## Google Sheets + Apps Script
1. Create a Google Sheet.
2. Open **Extensions → Apps Script**.
3. Paste `apps-script/Code.gs` into the script editor.
4. Deploy as **Web app** (access: anyone with link).
5. Copy the web app URL and paste it into `src/sheets.js` as `APPS_SCRIPT_URL`.
6. If URL is empty, app still works with localStorage fallback and shows a warning.

## GitHub Pages deployment
1. In `vite.config.js`, keep `base: './'` for project pages compatibility.
2. Commit and push repository.
3. Run `npm run deploy` (uses `gh-pages` and `dist/`).
4. In GitHub repo settings, enable Pages from `gh-pages` branch.

## Project structure
- `src/App.jsx` - all screens and app logic
- `src/sheets.js` - Google Apps Script POST integration
- `public/manifest.json` - PWA manifest
- `public/sw.js` - simple service worker cache
- `apps-script/Code.gs` - Apps Script endpoint

## Notes
- No backend other than Google Apps Script.
- Weekend tasks are allowed and treated toward the following week.
- Max weekend reward = 4 hours, max per day = 2 hours.
