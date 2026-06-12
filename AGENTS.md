# Project Conventions & Preferences

## Tech Stack

- **UI**: Preact 10 via `@preact/preset-vite`
- **UI Library**: MUI v5
- **Audio**: Tone.js v14
- **Waveform**: WaveSurfer.js v7
- **Build**: Vite 4 with TypeScript (strictNullChecks)

## Intentional Patterns

- Audio chain: `Player → Filter → Compressor → Tone.Destination`
- WaveSurfer.js is visualization only — Tone.js handles all audio playback
- `useThrottle` (250ms) on settings before syncing to Tone.js to avoid rapid re-configuration
- `mergeSettings()` helper for partial state updates using functional updater pattern
- Changelog is parsed at runtime from a static copy of `CHANGELOG.md` (not compiled in)

