# Changelog
This document lists the changes between release versions.

These are user-facing changes. To see the changes in the code between versions you can compare git tags.

## [Unreleased]

### Added

- Visual processing chain diagram showing the full signal flow from File through all effects (Speed → Distortion → Reverb → Delay → Chorus → BitCrusher → Filter → Compressor) to Output — each node lights up with its effect colour when enabled and fades when disabled, making the signal path readable at a glance
- BPM auto-detection via autocorrelation when a new audio file is loaded — detected tempo is displayed and can be applied as the active BPM
- Tempo section with manual BPM override (40–300 bpm range) and one-click Apply of detected BPM
- Delay sync-to-BPM mode — toggle the Delay card's "Sync" button to switch between manual time and note divisions (1/8, 1/4, 1/2, 1/1), with the actual delay time computed from the active BPM

### Changed

- Speed control simplified to single EffectCard — removed pitch slider, link toggle, and all dual-slider logic; speed-only with `playbackRate` control (0.1x–2x)
- Header made more compact: title reduced to `h6`/16px with subtitle inline and tighter padding
- Visual pipeline connectors added between each effect card using arrow icons, replacing the separate pipeline visualization strip above the effects
- Removed individual flow arrow indicator from each EffectCard
- Outer container body overflow fixed with `overflow: hidden` on html/body and card
- Card padding reduced from `p: 3` to `p: 2`; CardContent padding tightened
- Removed unused imports: `ChevronRightIcon`, `LinkIcon`, `LinkOffIcon`, `IconButton`

### Added

- Visual connector arrows between effect cards show the signal flow pipeline

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
