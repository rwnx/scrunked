# Changelog
This document lists the changes between release versions.

These are user-facing changes. To see the changes in the code between versions you can compare git tags.

## [Unreleased]

### Added

- Reverse effect card — toggles reverse playback via `Tone.Player.reverse`, placed next to Speed in the effects grid as a binary toggle (no slider). Waveform position and seek logic adjusts for reverse direction during playback, with a custom progress overlay that fills from left to right as audio plays backwards.
- Dynamic effects chain — effects can now be added/removed from the chain and reordered via drag and drop, with an "Add Effect" menu showing available effect types
- Effect cards now have a drag handle (top-left) and remove button (top-right, shown on hover) for managing effect positions and presence
- Snapping/sync control (`SnapControl`) — reusable BPM sync widget with Snap toggle and note division selector, embedded into all time-based effect cards (Delay, Reverb, Phaser, Tremolo, Chorus, AutoPan)
- Expanded note divisions — includes small increments down to 1/64 note, plus dotted and triplet variants (1/8., 1/4., 1/2., 1/1., 1/8t, 1/4t, 1/2t, 1/1t) for fine-grained tempo sync
- `noteToFrequency()` utility converts note divisions to LFO frequency (Hz) for sync on rate-based effects (Phaser, Tremolo, Chorus, AutoPan)
- Reverb sync-to-BPM: decay time can be snapped to note divisions
- Phaser sync-to-BPM: modulation rate snaps to note divisions
- Tremolo sync-to-BPM: modulation rate snaps to note divisions
- Chorus sync-to-BPM: modulation rate snaps to note divisions
- AutoPan sync-to-BPM: pan rate snaps to note divisions
- Sync settings persisted across sessions via localStorage (Zod-validated)

### Removed

- "Best in Chrome" footer line and associated ChromeIcon import

### Changed

- Effect cards now render in a responsive CSS Grid (`repeat(auto-fill, minmax(130px, 1fr))`) instead of a flex row with pipe connectors — cards reflow neatly into columns on smaller screens without visual artifacts
- Removed `PipeConnector` arrow icons between cards (the text-based chain display still shows signal flow)
- Effect card sizing is fully responsive: reduced padding and slider height on small screens (≤600px), full width within grid cells
- Main card container uses responsive padding/margins (`mx: { xs: 1, sm: 2 }`, `p: { xs: 1.5, sm: 2.5 }`)
- App header wraps the subtitle to a new line on narrow viewports
- Transport bar uses responsive gaps and padding
- Tempo section uses `flexWrap` for improved mobile layout
- Delay card refactored to use unified `SnapControl` widget instead of manual Sync button + select
- Reduced slider width on snap-enabled cards to `0.5` midpoint when sync is active (consistent visual cue across all effects)
- Note division select dropdown width increased from 36px to 46px to accommodate longer labels (e.g. 1/64, 1/8t)

### Fixed

- Delay note division select matches expanded list with all new division options
- Complete codebase restructuring: monolith index.tsx split into modular components (App.tsx, EffectCard.tsx, EffectsChain.tsx, TransportBar.tsx, FileDropArea.tsx, AppFooter.tsx) with centralized types in types.ts
- Signal flow reordered: Player → Speed → [Distortion] → [Phaser] → [Tremolo] → [Reverb] → [Delay] → [Chorus] → [BitCrusher] → [Filter] → [AutoPan] → Compressor → Destination
- Reduced waveform height from 100px to 80px for a more compact layout
- Drag-and-drop zone with visual feedback replaces the basic file input
- Effect cards now have rounded design with hover animations and color-coded accents
- Slimmer pipe connectors between cards with active/inactive states

### Fixed

- Detected BPM is now automatically applied when a new song is loaded, instead of requiring manual "Apply" button press
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
