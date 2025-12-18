# CadNav 2

Sequel to CadNav (IGSCadetOpenMap). Same general feature direction, but built to run cleanly as:
- Web
- iOS (via Expo)
- Android (via Expo)

No server components are included in this repo folder.

## Dev

```bash
npm install
npm run start
```

## Run targets

```bash
npm run web
npm run android
npm run ios
```

UI workshop notes: see docs/UI_PLAN.md
Project file guide: see docs/FILE_GUIDE.md

## Prototype

Current prototype is a **full-screen swipe pager** (Map ⇄ Tools ⇄ Settings) to match the UI plan.