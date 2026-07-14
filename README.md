# JARVIS Command Center

Futuristic AI assistant desktop UI built with Electron, React, and Three.js.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run dist
```

## Architecture

```
src/
├── main/index.ts       # Electron main process
├── preload/index.ts    # IPC bridge (stub for future backend)
├── renderer/index.html # App entry HTML
├── App.tsx             # Root layout
├── pages/              # Dashboard pages
├── components/         # UI widgets, voice, layout
├── services/           # Mock API + voice service interfaces
└── hooks/              # Clock, voice state
```

- **Electron** — desktop shell with frameless window
- **React + TypeScript** — UI components
- **Tailwind CSS** — styling with custom neon/glass theme
- **Three.js** — 3D wireframe globe hero widget
- **Mock services** — `IJarvisApi` and `IVoiceService` interfaces ready for backend swap

## Future Integration

Replace mock implementations in:
- `src/services/apiService.ts` — connect to your JARVIS backend API
- `src/services/voiceService.ts` — connect to your voice/STT/TTS service
- `electron/preload.ts` — expose IPC channels for native features
