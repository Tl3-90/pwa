# CommandVault

A PowerShell command reference library — organized, searchable, and installable as a Progressive Web App.

## Features

- Search commands by name, description, or tag
- Keyboard-native navigation (`/` to search, arrow keys to browse, `Enter` to copy)
- Add, edit, and delete commands
- Tracks last-used time and usage count per command
- Installable offline-capable PWA via service worker caching

## Getting Started

```bash
npm install
npm start
```

Builds to a static bundle with:

```bash
npm run build
```

## Tech Stack

- React 18 (Create React App / `react-scripts`)
- `lucide-react` for icons
