# CadNav2

A cross-platform navigation and mapping application built with React Native and Expo, featuring offline map support, GPS tracking, and route management.

## Quick Read

If you want the fastest path into the codebase, start with [docs/quick-read-index.md](docs/quick-read-index.md). For conventions, storage keys, and the two route stores, see [AGENTS.md](AGENTS.md).

## Features

- 📍 Real-time GPS tracking and navigation
- 🗺️ Offline map support with MapLibre
- 📌 Route saving and management
- 🧭 Compass overlay with magnetic declination correction
- 🎯 Grid reference system
- 📊 Elevation tracking via sensors
- 🎨 Theme customization
- 📱 Cross-platform (Android, iOS, Web)

## Tech Stack

- **Framework**: React Native with Expo
- **Maps**: MapLibre GL with Maptiler integration
- **Navigation**: Expo Router (file-based routing)
- **Storage**: AsyncStorage
- **Location**: Expo Location API
- **Sensors**: Expo Sensors (compass, accelerometer)
- **Styling**: React Native Theming
- **Build**: EAS (Expo Application Services)

## Project Structure

The code is organized around the Expo Router app in [app/](app/), UI and map code in [components/](components/), state in [hooks/](hooks/), design tokens in [constants/](constants/), shared types in [types/](types/), and small helpers in [lib/](lib/).

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment:
   ```bash
   # Create .env.local with required API keys (Maptiler token, etc.)
   cp .env.local.example .env.local
   ```

### Running the App

- **Development**:
  ```bash
  npm start
  ```

- **Android**:
  ```bash
  npm run android
  ```

- **iOS**:
  ```bash
  npm run ios
  ```

- **Web**:
  ```bash
  npm run web
  ```

### Building

- **Android Debug Build**:
  ```bash
  npm run build:android
  ```

- **Production Build** (EAS):
  ```bash
  eas build --platform android
  ```

## Linting

```bash
npm run lint
```

## Contributing

- Use TypeScript for type safety
- Follow the existing component structure
- Keep hooks focused and reusable
- Maintain theme consistency

## License

[Add your license here]
