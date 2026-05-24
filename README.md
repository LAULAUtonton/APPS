# Flight Points (PWA)

A mobile-first aviation-themed habit and reward tracker for kids.

## Setup
1. Install dependencies: `npm install`
2. Copy environment file: `cp .env.example .env`
3. (Optional) add Apps Script values into `.env`:
   - `VITE_APPS_SCRIPT_URL`
   - `VITE_APPS_SCRIPT_TOKEN`
4. Run locally: `npm run dev`

## Google Sheets + Apps Script
1. Create a Google Sheet and name a tab **FlightPoints** (or update `SHEET_NAME` in `apps-script/Code.gs`).
2. Open **Extensions → Apps Script**.
3. Paste `apps-script/Code.gs` into the script editor.
4. Set `SHARED_TOKEN` in `Code.gs` and use the same value in `.env` as `VITE_APPS_SCRIPT_TOKEN`.
5. Deploy as **Web app** (access: anyone with link).
6. Put the web app URL into `.env` as `VITE_APPS_SCRIPT_URL`.
7. If URL is empty, app still works with localStorage fallback and shows a warning.

## GitHub Pages deployment
1. In `vite.config.js`, keep `base: './'` for project pages compatibility.
2. Commit and push repository.
3. Run `npm run deploy` (uses `gh-pages` and `dist/`).
4. In GitHub repo settings, enable Pages from `gh-pages` branch.

## Project structure
- `src/App.jsx` - screens and app logic
- `src/utils.js` - local date + weekly/redeem helper utilities
- `src/sheets.js` - Google Apps Script POST integration
- `public/manifest.json` - PWA manifest
- `public/sw.js` - service worker with cache version cleanup
- `apps-script/Code.gs` - Apps Script endpoint with token and validation

## Notes
- No backend other than Google Apps Script.
- Weekend tasks are treated toward the following week.
- Max weekend reward = 4 hours, max per day = 2 hours.
