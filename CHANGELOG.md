# Changelog
This document lists the changes between release versions.

These are user-facing changes. To see the changes in the code between versions you can compare git tags.

## [Unreleased]

### Added

- Waveform scrubbing — click anywhere on the waveform to seek to that position in the track
- Waveform progress indicator now stays in sync with Tone.js playback position
- Toggleable audio effects: Distortion, Reverb, Delay, Chorus, BitCrusher — each can be enabled/disabled independently with zero CPU overhead when turned off
- Export processed audio as WAV file — render all effects and settings via Tone.Offline and download the result
- All effects are now displayed as responsive cards with vertical sliders, laid out in signal-processing order (Speed → Pitch → Distort → Reverb → Delay → Chorus → Crush → Filter) so the chain is readable at a glance
- Speed and Pitch are now separate togglable controls — Speed changes playback rate (tempo + pitch together), Pitch adds independent semitone shift via PitchShift
- Filter is now a togglable effect in the chain (was always-on), allowing an uncoloured signal path

### Changed

- Effects section layout redesigned: each effect is a self-contained card with checkbox, vertical slider, and value — no more grid rows
- Removed subtitle about saving CPU on effect toggle
- Outer container card is now responsive (`maxWidth: 1400, width: 100%`) instead of a fixed 500px
- Effect cards wrap onto new lines on narrow screens instead of showing a scrollbar

### Fixed

- Corrected compressor parameters to prevent quiet output and clipping

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
