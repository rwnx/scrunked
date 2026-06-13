# Changelog
This document lists the changes between release versions.

These are user-facing changes. To see the changes in the code between versions you can compare git tags.

## [Unreleased]

### Added

- Three new effects: Tremolo (rhythmic volume modulation with rate + depth), Phaser (sweeping notch filter with rate + depth), and AutoPan (automatic stereo panning with rate + depth) — 10 effects total in the chain
- Completely redesigned UI: modern glassmorphism-style effect cards with backdrop blur, drag-and-drop file upload area, improved waveform transport bar, compact header with loop toggle, and responsive layout
- Live active-chain display showing which effects are enabled in pipeline order (e.g. "Speed → Dist → Phase → Verb → Delay → LPF → Pan")
- Secondary sliders on multi-parameter effects (Phaser/Tremolo/Chorus/AutoPan depth controls) integrated directly into each card
- BPM auto-detection via autocorrelation when a new audio file is loaded — detected tempo is displayed and can be applied as the active BPM
- Tempo section with manual BPM override (40–300 bpm range) and one-click Apply of detected BPM
- Delay sync-to-BPM mode — toggle the Delay card's "Sync" button to switch between manual time and note divisions (1/8, 1/4, 1/2, 1/1), with the actual delay time computed from the active BPM
- Visual connector arrows between effect cards show the signal flow pipeline
- Settings persistence via localStorage (Zod-validated) across sessions

### Changed

- BPM detection now auto-applies when a new song loads — detected tempo is set as the active BPM immediately, with a green "✓ detected" badge shown for confirmation
- Delay sync mode uses slider with snap-to marks (1/8, 1/4, 1/2, 1/1) instead of separate toggle buttons — consistent with all other effect card controls
- Added Chorus sync-to-BPM: when sync is toggled on the Chorus card, the modulation rate snaps to note divisions (1/8, 1/4, 1/2, 1/1)
- BPM-synced delay/chorus values now account for playback speed — at 0.5x speed, delay time doubles and chorus rate halves (compensating for the audio being slower)
- Delay and chorus manual sliders use logarithmic scaling — small values get more slider space for fine control, with marks at musically-useful points
- Complete codebase restructuring: monolith index.tsx split into modular components (App.tsx, EffectCard.tsx, EffectsChain.tsx, TransportBar.tsx, FileDropArea.tsx, AppFooter.tsx) with centralized types in types.ts
- Signal flow reordered: Player → Speed → [Distortion] → [Phaser] → [Tremolo] → [Reverb] → [Delay] → [Chorus] → [BitCrusher] → [Filter] → [AutoPan] → Compressor → Destination
- Reduced waveform height from 100px to 80px for a more compact layout
- Drag-and-drop zone with visual feedback replaces the basic file input
- Effect cards now have rounded design with hover animations and color-coded accents
- Slimmer pipe connectors between cards with active/inactive states

### Fixed

- BPM detection now decodes audio data directly from the file blob (via `OfflineAudioContext.decodeAudioData`) instead of relying on `player.buffer.get()`, which could silently return null on some browsers
- Fixed `Uncaught TypeError: Tone.AutoPan is not a constructor` — Tone.js v14 renamed `AutoPan` to `AutoPanner`; updated constructor call accordingly

## [v0.1.1] - 2023-09-12
### Fixed

- Fixed a bug where the changelog module would not be correctly built on case-sensitive filesystems

## [v0.1.0] - 2023-09-12

Initial Release! 🎉

### Added

- Changelog
- Waveform Display
- Lowpass filter 1hz-22Khz
- Playback speed control
- daycore speed preset (45-to-33 0.733x)
- nightcore speed preset (33-to-45 1.334x)
- Chrome reccomendation to footer
- new Favicon!
