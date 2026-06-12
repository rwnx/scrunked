# Project Conventions & Preferences

## Tech Stack

- **UI**: Preact 10 via `@preact/preset-vite`
- **UI Library**: MUI v5
- **Audio**: Tone.js v14
- **Waveform**: WaveSurfer.js v7
- **Build**: Vite 4 with TypeScript (strictNullChecks)

## Intentional Patterns

### Audio Chain
- Full processing order: `Player → [Distortion] → [Reverb] → [Delay] → [Chorus] → [BitCrusher] → [Filter] → Compressor → Tone.Destination`
- Square brackets `[]` denote conditionally-connected effects (togglable on/off)
- Compressor is always present and always at the end before Destination

### Effects Cards
- Every effect is a togglable MUI Card with a checkbox, vertical slider, and value display — visual consistency communicates equal footing
- Cards are laid out left-to-right in audio processing chain order so signal flow is readable at a glance
- Vertical sliders are used because they communicate value at a glance without horizontal label collisions; this is a deliberate trade-off (less precise fine-tuning at narrow widths) in favour of compact card layout
- Disabled cards render at reduced opacity (0.55) with the slider disabled — faded but readable, preserving the spatial layout so the chain position stays visible
- The row uses `flexWrap: 'wrap'` rather than scrollbars — effect cards reflow onto new lines when the container is too narrow, making the full chain always visible without hidden overflow

### Speed
- Speed is a single togglable effect card with a vertical slider.
- Controls `player.playbackRate` (0.1x–2x), changing both tempo and pitch naturally (like a tape player).

### Filter
- Filter is a togglable lowpass effect in the chain — disabling it bypasses the filter entirely, useful for an uncoloured signal
- Sits after BitCrusher so it can smooth out aliasing artifacts from bitcrushing
- Uses a logarithmic frequency scale (1–22,000 Hz via `getScaleValue`/`getValueFromScale`) with simplified marks for the card layout

### General Patterns
- WaveSurfer.js is visualization only — Tone.js handles all audio playback
- `useThrottle` (250ms) on settings before syncing to Tone.js to avoid rapid re-configuration during slider drags
- `mergeSettings()` helper for partial state updates using functional updater pattern — prevents stale closures on the settings object
- Changelog is parsed at runtime from a static copy of `CHANGELOG.md` (not compiled in)
- The outer container card uses `maxWidth: 1400, width: '100%'` — it scales down on narrow viewports rather than overflowing the screen
- When adding a feature or fixing a bug, update `CHANGELOG.md` under the `[Unreleased]` section with the appropriate heading (`### Added`, `### Fixed`, etc.)

