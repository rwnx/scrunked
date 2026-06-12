import { render, FunctionComponent } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as Tone from 'tone'
import { ChangeEventHandler } from 'preact/compat';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

import { Duration } from 'luxon';
import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Input from '@mui/material/Input';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import createTheme from '@mui/material/styles/createTheme';
import Typography from '@mui/material/Typography';
import GitHubIcon from '@mui/icons-material/GitHub';
import Link from '@mui/material/Link';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import Changelog from "./Changelog"

import { useThrottle } from "@uidotdev/usehooks";
import {
  getScaleValue,
  getValueFromScale,
  humanFormat,
  audioBufferToWavBlob,
  downloadBlob,
  NoteDivision,
  NOTE_DIVISIONS,
  noteToSeconds,
  detectBpm,
} from './lib';
import WaveSurfer from 'wavesurfer.js';
import LoopIcon from '@mui/icons-material/Loop';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {ChromeIcon} from "./icons"
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { SvgIcon } from '@mui/material';
import { z } from 'zod';

type Settings = {
  speedEnabled: boolean,
  speed: number,
  filterEnabled: boolean,
  filterCutoff: number,
  file: File | undefined,
  duration: number | undefined
  nextFile: File | undefined,
  loop: boolean,
  state: "ready" | "init",
  // Effects
  distortionEnabled: boolean,
  distortionDrive: number,
  reverbEnabled: boolean,
  reverbDecay: number,
  delayEnabled: boolean,
  delayTime: number,
  delayFeedback: number,
  delayWet: number,
  chorusEnabled: boolean,
  chorusRate: number,
  chorusDepth: number,
  bitcrusherEnabled: boolean,
  bitcrusherBits: number,
  // BPM / Tempo
  bpm: number,
  bpmDetected: number | null,
  // Delay sync
  delaySyncEnabled: boolean,
  delayNoteDivision: NoteDivision,
}

const FILTER_MAX = 22_000

const STORAGE_KEY = "scrunked:settings"

// Schema for the subset of Settings that persists across sessions
// (excludes session-only fields like file, duration, state)
const persistedSettingsSchema = z.object({
  filterCutoff: z.number(),
  speed: z.number(),
  loop: z.boolean(),
  distortionEnabled: z.boolean(),
  distortionDrive: z.number(),
  reverbEnabled: z.boolean(),
  reverbDecay: z.number(),
  delayEnabled: z.boolean(),
  delayTime: z.number(),
  delayFeedback: z.number(),
  delayWet: z.number(),
  chorusEnabled: z.boolean(),
  chorusRate: z.number(),
  chorusDepth: z.number(),
  bitcrusherEnabled: z.boolean(),
  bitcrusherBits: z.number(),
})

/** Picks only persisted fields from a full Settings object, validated via Zod. */
function pickPersisted(settings: Settings): z.infer<typeof persistedSettingsSchema> {
  return persistedSettingsSchema.parse(settings)
}

function loadPersistedSettings(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = persistedSettingsSchema.partial().parse(JSON.parse(raw))
    return parsed as Partial<Settings>
  } catch {
    return {}
  }
}

function savePersistedSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pickPersisted(settings)))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

const mergeSettings = (next: Partial<Settings>) => (state: Settings) => ({
  ...state,
  ...next
})

const filterCutoffMarks = [
  { value: getScaleValue(10), label: "10" },
  { value: getScaleValue(250), label: "250" },
  { value: getScaleValue(1_000), label: "1k" },
  { value: getScaleValue(2_500), label: "2.5k" },
  { value: getScaleValue(5_000), label: "5k" },
  { value: getScaleValue(9_000), label: "10k" },
  { value: getScaleValue(15_000), label: "15k" },
  { value: getScaleValue(22_000), label: "22k" },
]

// ── Effect theming ──────────────────────────────────────────────
const EFFECT_COLORS = {
  speed: '#4fc3f7',     // light blue — time domain
  distortion: '#ef5350', // red — waveshaping / harmonic
  reverb: '#66bb6a',    // green — spatial
  delay: '#26a69a',     // teal — time-based echo
  chorus: '#26a69a',    // teal — modulation
  bitcrusher: '#ffa726',// orange — digital / lo-fi
  filter: '#ab47bc',    // purple — frequency
} as const

const EFFECT_TOOLTIPS: Record<string, string> = {
  distortion: 'Adds grit by clipping the waveform. Turn up for aggressive, warm saturation.',
  reverb: 'Simulates acoustic space — larger decay = bigger room.',
  delay: 'Echo effect with ping-pong stereo panning. Time, feedback, and mix controls.',
  chorus: 'Thickens sound by doubling with modulation. Creates a swirling, lush texture.',
  bitcrusher: 'Reduces audio resolution for lo-fi digital artifacts. Lower bits = more crunch.',
  filter: 'Low-pass filter — cuts high frequencies for a darker, muffled sound.',
  speed: 'Changes playback speed (tempo and pitch together, like a tape player).',
}

// ── Effect card builder ─────────────────────────────────────────
type CardDef = {
  color: string
  label: string
  tooltip: string
  enabled: boolean
  sliderValue: number
  sliderMin: number
  sliderMax: number
  sliderStep: number
  marks?: { value: number; label: string }[]
  displayValue: string
  onToggle: (checked: boolean) => void
  onChange: (value: number) => void
}

const EffectCard = ({
  color,
  label,
  tooltip,
  enabled,
  sliderValue,
  sliderMin,
  sliderMax,
  sliderStep,
  marks,
  displayValue,
  onToggle,
  onChange,
}: CardDef) => (
  <Card
    sx={{
      minWidth: 100,
      flex: '0 1 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: 1.5,
      px: 0.5,
      opacity: enabled ? 1 : 0.55,
      borderLeft: 4,
      borderLeftColor: color,
      borderRadius: 1.5,
      position: 'relative',
      transition: 'opacity 0.2s, box-shadow 0.2s',
      '&:hover': { boxShadow: 2 },
    }}
  >

    <Box display="flex" alignItems="center" flexDirection="column" mb={0.5}>
      <Tooltip title={tooltip} placement="top">
        <Checkbox
          checked={enabled}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          sx={{ py: 0, px: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }}
          size="small"
        />
      </Tooltip>
      <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.1, fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
    <Slider
      orientation="vertical"
      value={sliderValue}
      max={sliderMax}
      min={sliderMin}
      step={sliderStep}
      marks={marks}
      sx={{ height: 120, mb: 0.25 }}
      disabled={!enabled}
      onChange={(_, value) => {
        if (Array.isArray(value)) throw new Error('single value required')
        onChange(value as number)
      }}
    />
    <Typography variant="caption" sx={{ fontSize: 11 }}>
      {displayValue}
    </Typography>
  </Card>
)

const App: FunctionComponent = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
        },
      }),
    [prefersDarkMode],
  );

  const [settings, set] = useState<Settings>({
    speedEnabled: true,
    speed: 1,
    filterEnabled: true,
    filterCutoff: FILTER_MAX,
    loop: true,
    file: undefined,
    duration: undefined,
    nextFile: undefined,
    state: "init",
    // Effects - all disabled by default to save CPU
    distortionEnabled: false,
    distortionDrive: 0.5,
    reverbEnabled: false,
    reverbDecay: 2,
    delayEnabled: false,
    delayTime: 0.25,
    delayFeedback: 0.3,
    delayWet: 0.5,
    chorusEnabled: false,
    chorusRate: 1.5,
    chorusDepth: 0.7,
    bitcrusherEnabled: false,
    bitcrusherBits: 8,
    // BPM
    bpm: 120,
    bpmDetected: null,
    delaySyncEnabled: false,
    delayNoteDivision: '1/4',
    ...loadPersistedSettings(),
  })

  const throttledSettings = useThrottle(settings, 250)

  const [player] = useState(new Tone.Player())
  const [filter] = useState(new Tone.Filter(settings.filterCutoff, "lowpass", -48))
  const [comp] = useState(new Tone.Compressor(-24, 12))

  // Audio effects - created once, connected/disconnected dynamically to avoid CPU overhead
  const [distortion] = useState(() => new Tone.Distortion(0.5))
  const [reverb] = useState(() => new Tone.Reverb({ decay: 2 }))
  const [delay] = useState(() => new Tone.PingPongDelay(0.25, 0.3))
  const [chorus] = useState(() => new Tone.Chorus(1.5, 3.5, 0.7))
  const [bitcrusher] = useState(() => new Tone.BitCrusher(8))

  const waveformRef = useRef<HTMLDivElement | null>(null)
  const [waveform, setWaveform] = useState<WaveSurfer | undefined>()
  const [seekPosition, setSeekPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Refs to track playback timing for progress calculation
  const playbackStartTimeRef = useRef(0)
  const playbackOffsetRef = useRef(0)

  useEffect((() => {
    if (!waveformRef.current) return undefined
    if (waveform) {
      waveform.destroy()
    }
    const next = WaveSurfer.create({
      container: waveformRef.current,
      height: 100,
      waveColor: theme.palette.primary.main,
      progressColor: theme.palette.text.secondary,
      cursorWidth: 0,
      interact: true
    })

    // When user clicks on the waveform, seek the Tone.js player to that position
    next.on('interaction', (newTime: number) => {
      setSeekPosition(newTime)
      if (player.state === "started") {
        player.stop()
        player.start(0, newTime)
        playbackStartTimeRef.current = Tone.now()
        playbackOffsetRef.current = newTime
      }
    })

    setWaveform(next)
  }), [waveformRef.current])

  // Sync WaveSurfer's progress indicator with Tone.js playback position
  useEffect(() => {
    if (!waveform || !settings.duration) return

    const interval = setInterval(() => {
      if (player.state === "started" && settings.duration) {
        const elapsed = Tone.now() - playbackStartTimeRef.current
        const position = Math.min(playbackOffsetRef.current + elapsed, settings.duration)
        const progress = position / settings.duration
        waveform.seekTo(progress)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [waveform, isPlaying, settings.duration])

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = async (onChange) => {
    const file = onChange.currentTarget?.files?.[0]
    if (!file) throw new Error("missing file at upload time")

    set(mergeSettings({ nextFile: file }))
  }

  // Rebuild the audio chain, connecting only enabled effects to save CPU
  const rebuildChain = useCallback(() => {
    // Stop chorus LFO before disconnecting (saves CPU, avoids dangling audio processing)
    try { (chorus as any).stop() } catch {}

    // Disconnect everything downstream first
    try { player.disconnect() } catch {}
    try { distortion.disconnect() } catch {}
    try { reverb.disconnect() } catch {}
    try { delay.disconnect() } catch {}
    try { chorus.disconnect() } catch {}
    try { bitcrusher.disconnect() } catch {}
    try { filter.disconnect() } catch {}
    try { comp.disconnect() } catch {}

    // Rebuild chain through enabled effects only
    // Order: Player → Distortion → Reverb → Delay → Chorus → BitCrusher → Filter → Compressor → Destination
    let lastNode: Tone.ToneAudioNode = player
    if (settings.distortionEnabled) { lastNode.connect(distortion); lastNode = distortion }
    if (settings.reverbEnabled) { lastNode.connect(reverb); lastNode = reverb }
    if (settings.delayEnabled) { lastNode.connect(delay); lastNode = delay }
    if (settings.chorusEnabled) {
      lastNode.connect(chorus)
      try { (chorus as any).start() } catch {} // start LFO modulation
      lastNode = chorus
    }
    if (settings.bitcrusherEnabled) { lastNode.connect(bitcrusher); lastNode = bitcrusher }
    if (settings.filterEnabled) { lastNode.connect(filter); lastNode = filter }
    lastNode.connect(comp)
    comp.connect(Tone.Destination)
  }, [settings.distortionEnabled, settings.reverbEnabled, settings.delayEnabled, settings.chorusEnabled, settings.bitcrusherEnabled, settings.filterEnabled, player, distortion, reverb, delay, chorus, bitcrusher, filter, comp])

  useEffect(() => {
    async function syncPlayerSettings() {
      if (settings.state === "init") {
        // Initial chain setup (no effects enabled by default)
        rebuildChain()

        set((prev) => ({
          ...prev,
          state: "ready",
        }))
        return
      }

      if (settings.nextFile) {
        waveform?.loadBlob(settings.nextFile)
        const url = URL.createObjectURL(settings.nextFile)
        player.stop()
        await player.load(url)
        player.start()
        playbackStartTimeRef.current = Tone.now()
        playbackOffsetRef.current = 0
        setSeekPosition(0)
        setIsPlaying(true)
        const duration = player.buffer.duration
        // Auto-detect BPM — decode from the raw file (more reliable than player.buffer.get())
        let detectedBpm: number | null = null
        try {
          const arrayBuffer = await settings.nextFile.arrayBuffer()
          const audioCtx = new OfflineAudioContext(1, 1, 44100)
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
          detectedBpm = detectBpm(audioBuffer)
        } catch (err) {
          console.warn('BPM detection failed:', err)
        }
        set(mergeSettings({
          file: settings.nextFile,
          nextFile: undefined,
          duration,
          bpmDetected: detectedBpm,
        }))
      }

      // Rebuild chain to reflect any effect toggle changes
      rebuildChain()

      // Update effect parameters
      distortion.set({ distortion: settings.distortionDrive })
      reverb.set({ decay: settings.reverbDecay })
      const delayTime = settings.delaySyncEnabled
        ? noteToSeconds(settings.delayNoteDivision, settings.bpm)
        : settings.delayTime
      delay.set({ delayTime, feedback: settings.delayFeedback, wet: settings.delayWet })
      chorus.set({ frequency: settings.chorusRate, depth: settings.chorusDepth })
      bitcrusher.set({ bits: settings.bitcrusherBits })
      if (settings.speedEnabled) {
        player.set({ playbackRate: settings.speed, loop: settings.loop })
      } else {
        player.set({ playbackRate: 1, loop: settings.loop })
      }

      filter.set({ frequency: settings.filterCutoff })
    }

    syncPlayerSettings()
  }, [throttledSettings, waveform, rebuildChain])

  // Persist settings to localStorage on every change
  useEffect(() => {
    savePersistedSettings(settings)
  }, [settings])


  const handlePlayPauseToggle = () => {
    if (!player) return
    if (player.state === "started") {
      player.stop()
      // Save the current position where playback stopped
      if (settings.duration) {
        const elapsed = Tone.now() - playbackStartTimeRef.current
        const position = Math.min(playbackOffsetRef.current + elapsed, settings.duration)
        setSeekPosition(position)
      }
      setIsPlaying(false)
    } else {
      player.start(0, seekPosition)
      playbackStartTimeRef.current = Tone.now()
      playbackOffsetRef.current = seekPosition
      setIsPlaying(true)
    }
  }

  const handleExport = async () => {
    const audioBuffer = player.buffer?.get()
    if (!audioBuffer || !settings.duration) return

    setIsExporting(true)
    try {
      // Calculate the rendered duration — speed changes playback length
      const duration = settings.duration / settings.speed

      const result = await Tone.Offline(async () => {
        // Create a fresh audio chain inside the offline context
        const offlinePlayer = new Tone.Player(audioBuffer)
        const offlineFilter = new Tone.Filter(settings.filterCutoff, "lowpass", -48)
        const offlineComp = new Tone.Compressor(-24, 12)

        // Effects
        const distortion = new Tone.Distortion(settings.distortionDrive)
        const reverb = new Tone.Reverb({ decay: settings.reverbDecay })
        await reverb.ready
        const delayTime = settings.delaySyncEnabled
          ? noteToSeconds(settings.delayNoteDivision, settings.bpm)
          : settings.delayTime
        const delay = new Tone.PingPongDelay(delayTime, settings.delayFeedback)
        delay.set({ wet: settings.delayWet })
        const chorus = new Tone.Chorus(settings.chorusRate, 3.5, settings.chorusDepth)
        const bitcrusher = new Tone.BitCrusher(settings.bitcrusherBits)

        // Build chain (mirrors rebuildChain logic)
        let last: Tone.ToneAudioNode = offlinePlayer
        if (settings.distortionEnabled) { last.connect(distortion); last = distortion }
        if (settings.reverbEnabled) { last.connect(reverb); last = reverb }
        if (settings.delayEnabled) { last.connect(delay); last = delay }
        if (settings.chorusEnabled) { last.connect(chorus); (chorus as any).start(); last = chorus }
        if (settings.bitcrusherEnabled) { last.connect(bitcrusher); last = bitcrusher }
        last.connect(offlineFilter)
        offlineFilter.connect(offlineComp)
        offlineComp.toDestination()

        // Configure & play
        offlinePlayer.loop = false
        offlinePlayer.playbackRate = settings.speed
        offlinePlayer.start(0)
      }, duration)

      // Convert to WAV and trigger download
      const wavBlob = audioBufferToWavBlob(result.get()!)
      const baseName = settings.file!.name.replace(/\.[^/.]+$/, "")
      downloadBlob(wavBlob, `${baseName}_scrunked.wav`)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (<>
    <ThemeProvider theme={theme}>
    <CssBaseline />
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
        minHeight="100dvh"
        sx={{ overflow: 'hidden' }}
      >

        <Card sx={{ maxWidth: 1400, width: '100%', mx: 2, p: 2, overflow: 'hidden' }}>
          <Box display="flex" alignItems="baseline" gap={1} sx={{ mb: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, fontSize: 16 }}>scrunked</Typography>
            <Typography sx={{ fontSize: 12 }} color="text.secondary">a toolkit for ruining your favourite music</Typography>
          </Box>
          <CardContent sx={{ "&:last-child": { pb: 1 }, pt: 0 }}>
            <Grid container mt={2} spacing={2}>
            <Grid item xs={11}>
              <Input type="file" sx={{ width: "100%", pt: 1, pb: 1 }} onChange={handleFileChange} accept={"audio/wav, audio/ogg, audio/mp3, audio/flac, audio/acc, audio/mpeg"} />
            </Grid>
            <Grid item xs={1}>
            <Tooltip title={settings.loop ? "Loop" : "Play Once"}>
              <Checkbox checked={settings.loop} icon={<ArrowRightAltIcon />} checkedIcon={<LoopIcon />} onChange={(evt) => set({...settings, loop: evt.currentTarget.checked})} />
              </Tooltip>
              </Grid>
            </Grid>




            {settings.file || settings.nextFile ? <>
              <Grid container spacing={2}>
                  <Grid item xs={2}>
                    <Box display="flex" height="100%" justifyContent="center" alignItems="center">
                      <Button onClick={handlePlayPauseToggle}>{isPlaying ? <PauseIcon /> : <PlayArrowIcon />}</Button>
                    </Box>
                  </Grid>
                  <Grid item xs={7}>
                    <Box sx={{ m: 1 }} ref={waveformRef}></Box>
                  </Grid>
                  <Grid item xs={1}>
                    <Box display="flex" height="100%" justifyContent="center" alignItems="center">
                      {Duration.fromObject({ seconds: settings.duration }).toFormat("mm:ss")}
                    </Box>
                  </Grid>
                  <Grid item xs={2}>
                    <Box display="flex" height="100%" justifyContent="center" alignItems="center">
                      <Tooltip title="Export processed audio as WAV">
                        <span>
                          <Button
                            onClick={handleExport}
                            disabled={isExporting || !settings.file}
                            size="small"
                          >
                            {isExporting ? "..." : <FileDownloadIcon />}
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </Grid>
                </Grid>

            </> : null}



            {/* BPM / Tempo Section */}
            <Box
              display="flex"
              alignItems="center"
              sx={{ mt: 2, mb: 1, gap: 1.5 }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Tempo
              </Typography>
              <Box
                display="flex"
                alignItems="center"
                gap={0.5}
                sx={{
                  px: 1,
                  py: 0.3,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 13 }}>
                  {settings.bpm}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>
                  bpm
                </Typography>
                {settings.bpmDetected !== null && (
                  <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', ml: 0.5 }}>
                    {settings.bpmDetected === settings.bpm ? '✓ detected' : `(detected ${settings.bpmDetected})`}
                  </Typography>
                )}
              </Box>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Input
                  type="number"
                  value={settings.bpm}
                  onChange={(e: any) => {
                    const val = parseInt(e.currentTarget.value, 10)
                    if (!isNaN(val) && val >= 40 && val <= 300) {
                      set(mergeSettings({ bpm: val }))
                    }
                  }}
                  sx={{ width: 60, '& input': { fontSize: 12, py: 0.5, textAlign: 'center' } }}
                  inputProps={{ min: 40, max: 300, step: 1 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 10, py: 0.2, minWidth: 0, whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (settings.bpmDetected) {
                      set(mergeSettings({ bpm: settings.bpmDetected }))
                    }
                  }}
                  disabled={!settings.bpmDetected}
                >
                  Apply
                </Button>
              </Box>
            </Box>

            {/* Effects Section */}
            <Box
              display="flex"
              alignItems="baseline"
              sx={{ mt: 1, mb: 1 }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Effects
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <EffectCard
                color={EFFECT_COLORS.speed}
                label="Speed"
                tooltip={EFFECT_TOOLTIPS.speed}
                enabled={settings.speedEnabled}
                sliderValue={settings.speed}
                sliderMin={0.1}
                sliderMax={2}
                sliderStep={0.01}
                marks={[
                  { value: 0.5, label: "0.5" },
                  {value: 0.7334, label: "day" },
                  { value: 1, label: "1x" },
                  {value: 1.3636, label: "night" },
                  { value: 2, label: "2x" },
                ]}
                displayValue={`${Math.round(settings.speed * 100)}%`}
                onToggle={(checked) => set(mergeSettings({ speedEnabled: checked }))}
                onChange={(value) => set(mergeSettings({ speed: value }))}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  color: 'text.disabled',
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 20 }} />
              </Box>
              {/* Distortion */}
              <EffectCard
                color={EFFECT_COLORS.distortion}
                label="Distortion"
                tooltip={EFFECT_TOOLTIPS.distortion}
                enabled={settings.distortionEnabled}
                sliderValue={settings.distortionDrive}
                sliderMin={0}
                sliderMax={1}
                sliderStep={0.01}
                displayValue={settings.distortionDrive.toFixed(2)}
                onToggle={(checked) => set(mergeSettings({ distortionEnabled: checked }))}
                onChange={(value) => set(mergeSettings({ distortionDrive: value }))}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  color: 'text.disabled',
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 20 }} />
              </Box>
              {/* Reverb */}
              <EffectCard
                color={EFFECT_COLORS.reverb}
                label="Reverb"
                tooltip={EFFECT_TOOLTIPS.reverb}
                enabled={settings.reverbEnabled}
                sliderValue={settings.reverbDecay}
                sliderMin={0.1}
                sliderMax={10}
                sliderStep={0.1}
                displayValue={`${settings.reverbDecay.toFixed(1)}s`}
                onToggle={(checked) => set(mergeSettings({ reverbEnabled: checked }))}
                onChange={(value) => set(mergeSettings({ reverbDecay: value }))}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  color: 'text.disabled',
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 20 }} />
              </Box>

              {/* Delay — with BPM sync */}
              <Card
                sx={{
                  minWidth: 120,
                  flex: '0 1 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  py: 1.5,
                  px: 0.5,
                  opacity: settings.delayEnabled ? 1 : 0.55,
                  borderLeft: 4,
                  borderLeftColor: EFFECT_COLORS.delay,
                  borderRadius: 1.5,
                  transition: 'opacity 0.2s, box-shadow 0.2s',
                  '&:hover': { boxShadow: 2 },
                }}
              >
                <Box display="flex" alignItems="center" flexDirection="column" mb={0.5}>
                  <Tooltip title={EFFECT_TOOLTIPS.delay} placement="top">
                    <Checkbox
                      checked={settings.delayEnabled}
                      onChange={(e) => set(mergeSettings({ delayEnabled: e.currentTarget.checked }))}
                      sx={{ py: 0, px: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }}
                      size="small"
                    />
                  </Tooltip>
                  <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.1, fontWeight: 500 }}>
                    Delay
                  </Typography>
                </Box>
                {settings.delaySyncEnabled ? (
                  <>
                    {/* Note division selector — discrete clicks */}
                    <Box display="flex" flexDirection="column" alignItems="center" sx={{ height: 120, justifyContent: 'center', mb: 0.25 }}>
                      {NOTE_DIVISIONS.map((note) => (
                        <Button
                          key={note}
                          size="small"
                          variant={settings.delayNoteDivision === note ? 'contained' : 'text'}
                          onClick={() => set(mergeSettings({ delayNoteDivision: note }))}
                          sx={{
                            fontSize: 10,
                            py: 0.1,
                            minWidth: 40,
                            lineHeight: 1.2,
                            color: settings.delayNoteDivision === note ? undefined : EFFECT_COLORS.delay,
                          }}
                        >
                          {note}
                        </Button>
                      ))}
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: 10 }}>
                      {noteToSeconds(settings.delayNoteDivision, settings.bpm).toFixed(3)}s
                    </Typography>
                  </>
                ) : (
                  <>
                    <Slider
                      orientation="vertical"
                      value={settings.delayTime}
                      max={1}
                      min={0.01}
                      step={0.01}
                      sx={{ height: 120, mb: 0.25 }}
                      disabled={!settings.delayEnabled}
                      onChange={(_, value) => {
                        if (Array.isArray(value)) throw new Error('single value required')
                        set(mergeSettings({ delayTime: value as number }))
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: 11 }}>
                      {settings.delayTime.toFixed(2)}s
                    </Typography>
                  </>
                )}
                {/* Sync toggle */}
                <Tooltip title="Sync delay to BPM">
                  <Button
                    size="small"
                    variant={settings.delaySyncEnabled ? 'contained' : 'outlined'}
                    onClick={() => set(mergeSettings({ delaySyncEnabled: !settings.delaySyncEnabled }))}
                    sx={{
                      mt: 0.5,
                      fontSize: 9,
                      py: 0.1,
                      minWidth: 36,
                      lineHeight: 1.1,
                      color: settings.delaySyncEnabled ? undefined : EFFECT_COLORS.delay,
                      borderColor: EFFECT_COLORS.delay,
                    }}
                  >
                    Sync
                  </Button>
                </Tooltip>
              </Card>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  color: 'text.disabled',
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 20 }} />
              </Box>
              {/* Chorus */}
              <EffectCard
                color={EFFECT_COLORS.chorus}
                label="Chorus"
                tooltip={EFFECT_TOOLTIPS.chorus}
                enabled={settings.chorusEnabled}
                sliderValue={settings.chorusRate}
                sliderMin={0.1}
                sliderMax={10}
                sliderStep={0.1}
                displayValue={`${settings.chorusRate.toFixed(1)}hz`}
                onToggle={(checked) => set(mergeSettings({ chorusEnabled: checked }))}
                onChange={(value) => set(mergeSettings({ chorusRate: value }))}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  color: 'text.disabled',
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 20 }} />
              </Box>
              {/* BitCrusher */}
              <EffectCard
                color={EFFECT_COLORS.bitcrusher}
                label="Bit Crush"
                tooltip={EFFECT_TOOLTIPS.bitcrusher}
                enabled={settings.bitcrusherEnabled}
                sliderValue={settings.bitcrusherBits}
                sliderMin={1}
                sliderMax={16}
                sliderStep={1}
                marks={[
                  { value: 1, label: "1" },
                  { value: 8, label: "8" },
                  { value: 16, label: "16" },
                ]}
                displayValue={`${settings.bitcrusherBits}bit`}
                onToggle={(checked) => set(mergeSettings({ bitcrusherEnabled: checked }))}
                onChange={(value) => set(mergeSettings({ bitcrusherBits: value }))}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  color: 'text.disabled',
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 20 }} />
              </Box>
              {/* Filter */}
              <EffectCard
                color={EFFECT_COLORS.filter}
                label="Filter"
                tooltip={EFFECT_TOOLTIPS.filter}
                enabled={settings.filterEnabled}
                sliderValue={getScaleValue(settings.filterCutoff)}
                sliderMin={1}
                sliderMax={filterCutoffMarks[filterCutoffMarks.length - 1].value}
                sliderStep={0.1}
                marks={[
                  { value: getScaleValue(10), label: "10" },
                  { value: getScaleValue(100), label: "100" },
                  { value: getScaleValue(1_000), label: "1k" },
                  { value: getScaleValue(10_000), label: "10k" },
                  { value: getScaleValue(22_000), label: "22k" },
                ]}
                displayValue={`${humanFormat(settings.filterCutoff)}hz`}
                onToggle={(checked) => set(mergeSettings({ filterEnabled: checked }))}
                onChange={(value) => set(mergeSettings({ filterCutoff: getValueFromScale(value) }))}
              />
            </Box>

          </CardContent>
        </Card>
        <Typography sx={{ fontSize: 14, mt: 1 }} color="text.secondary">Inspired by <Link href="https://github.com/dumbmatter/screw">Screw</Link> 🔩 Built with love by <Link href="https://github.com/rwnx">Rowan</Link>✨</Typography>

        <Typography sx={{ fontSize: 14, mt: 1, display: "flex", gap: 0.5 }}color="text.secondary">Runs best in <SvgIcon fontSize='small'>{ChromeIcon}</SvgIcon> Chrome</Typography>
        <Changelog />
        <Typography sx={{ mt: 1 }} color="text.secondary"> <Button href={"https://github.com/rwnx/scrunked"}><GitHubIcon sx={{ mr: 0.5 }} />view on github</Button> </Typography>
      </Box>
    </ThemeProvider>
  </>
  );
}
const appNode = document.getElementById('app')
if (!appNode) throw new Error("unable to find app node")

render(<App />, appNode);
