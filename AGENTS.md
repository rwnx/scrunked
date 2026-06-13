# Project Conventions & Preferences

## Tech Stack

- **UI**: Preact 10 via `@preact/preset-vite`
- **UI Library**: MUI v5
- **Audio**: Tone.js v14
- **Waveform**: WaveSurfer.js v7
- **Build**: Vite 4 with TypeScript (strictNullChecks)

## Intentional Patterns

### Audio Chain
- Full processing order: `Player → Speed → [Distortion] → [Phaser] → [Tremolo] → [Reverb] → [Delay] → [Chorus] → [BitCrusher] → [Filter] → [AutoPan] → Compressor → Tone.Destination`
- Square brackets `[]` denote conditionally-connected effects (togglable on/off)
- Compressor is always present and always at the end before Destination

### Effect Cards
- Every effect is a togglable MUI Card with a checkbox, vertical slider, and value display — visual consistency communicates equal footing
- Cards are laid out left-to-right in audio processing chain order so signal flow is readable at a glance
- Multi-parameter effects (Phaser, Tremolo, Chorus, AutoPan) have secondary horizontal sliders rendered as children inside the card
- The row uses `flexWrap: 'wrap'` rather than scrollbars — effect cards reflow onto new lines when the container is too narrow
- Disabled cards render at reduced opacity (0.55) with all sliders disabled

### File Structure
- `src/index.tsx` — entry point, only renders `<App />`
- `src/App.tsx` — main app component with state management, audio engine, and layout
- `src/types.ts` — type definitions, constants (colors, tooltips), Zod schema, and re-exports from lib.ts
- `src/lib.ts` — utility functions (scale, BPM detection, WAV export)
- `src/components/EffectCard.tsx` — reusable card component with optional children for secondary controls
- `src/components/EffectsChain.tsx` — horizontal chain of all effect cards with pipe connectors and live chain display
- `src/components/TransportBar.tsx` — waveform display, play/pause, time, export
- `src/components/FileDropArea.tsx` — drag-and-drop file upload zone
- `src/components/AppFooter.tsx` — footer with links and changelog

### Speed
- Speed is a single togglable effect card with a vertical slider.
- Controls `player.playbackRate` (0.1x–2x), changing both tempo and pitch naturally (like a tape player).

### Filter
- Filter is a togglable lowpass effect in the chain — disabling it bypasses the filter entirely
- Sits after BitCrusher so it can smooth out aliasing artifacts from bitcrushing
- Uses a logarithmic frequency scale (1–22,000 Hz via `getScaleValue`/`getValueFromScale`)

### General Patterns
- WaveSurfer.js is visualization only — Tone.js handles all audio playback
- `useThrottle` (250ms) on settings before syncing to Tone.js to avoid rapid re-configuration during slider drags
- `mergeSettings()` helper for partial state updates using functional updater pattern
- Changelog is parsed at runtime from a static copy of `CHANGELOG.md` (not compiled in)
- The outer container card uses `maxWidth: 1400, width: '100%'` — it scales down on narrow viewports
- When adding a feature or fixing a bug, update `CHANGELOG.md` under the `[Unreleased]` section

