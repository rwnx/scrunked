# Changelog
This document lists the changes between release versions.

These are user-facing changes. To see the changes in the code between versions you can compare git tags.

## [Unreleased]

## [v0.2.0] - 2026-06-15

### Added

- Multiple effect instances — the same effect type can now be added to the chain more than once
- Reverse playback as a togglable effect
- Dynamic effects chain — add, remove, and reorder effects via drag-and-drop
- BPM sync (Snap to tempo) for time-based effects (Delay, Reverb, Phaser, Tremolo, Chorus, AutoPan)
- Expanded note divisions including dotted and triplet variants
- Drag-and-drop file upload with visual feedback
- Export processed audio as WAV
- Auto-applied BPM detection on new song load
- Responsive layout improvements for mobile and narrow viewports

### Changed

- Complete codebase restructuring into modular components
- Signal flow reordered for consistent processing order
- Effects rendered in a responsive grid layout
- Performance: audio chain only rebuilt on topology changes
- UI refinements — rounded card design, hover animations, color accents
- Sync settings persisted across sessions via localStorage

### Fixed

- BPM detection now decodes audio directly from the file blob instead of relying on player.buffer.get()
- Fixed `Tone.AutoPan` → `Tone.AutoPanner` constructor for Tone.js v14 compatibility
- Delay note division select includes all expanded division options

### Removed

- "Best in Chrome" footer line
- Pipe connector arrows between effect cards (chain now shown as text)

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
