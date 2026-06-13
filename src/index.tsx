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
  // Tempo sync
  delaySyncEnabled: boolean,
  delayNoteDivision: NoteDivision,
  chorusSyncEnabled: boolean,
  chorusNoteDivision: NoteDivision,
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
    elevation={enabled ? 2 : 0}
    sx={{
      minWidth: 100,
      flex: '0 1 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: 1.5,
      px: 0.5,
      opacity: enabled ? 1 : 0.5,
      border: '1px solid',
      borderColor: enabled ? `${color}44` : 'divider',
      borderLeft: 4,
      borderLeftColor: color,
      borderRadius: 2,
      position: 'relative',
      bgcolor: enabled ? `${color}08` : 'transparent',
      transition: 'all 0.25s ease',
      '&:hover': {
        boxShadow: enabled ? 4 : 0,
        bgcolor: enabled ? `${color}12` : 'action.hover',
      },
      '& .MuiSlider-thumb': {
        display: enabled ? 'block' : 'none',
      },
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
      <Typography
        variant="caption"
        sx={{
          fontSize: 11,
          lineHeight: 1.1,
          fontWeight: 600,
          color: enabled ? color : 'text.disabled',
          textDecoration: enabled ? 'none' : 'line-through',
          transition: 'color 0.2s',
        }}
      >
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
      sx={{
        height: 120,
        mb: 0.25,
        '& .MuiSlider-track': {
          border: 'none',
          bgcolor: enabled ? color : undefined,
        },
        '& .MuiSlider-thumb': {
          bgcolor: enabled ? color : undefined,
        },
        '& .MuiSlider-rail': {
          opacity: enabled ? 0.3 : 0.15,
        },
      }}
      disabled={!enabled}
      onChange={(_, value) => {
        if (Array.isArray(value)) throw new Error('single value required')
        onChange(value as number)
      }}
    />
    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 500, color: enabled ? 'text.primary' : 'text.disabled' }}>
      {displayValue}
    </Typography>
  </Card>
)

const PipeConnector = ({ color }: { color?: string }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'center',
      color: color ?? 'text.disabled',
      opacity: color ? 0.7 : 0.25,
      flexShrink: 0,
      transition: 'color 0.2s, opacity 0.2s',
      mx: 0.25,
    }}
  >
    <ArrowForwardIcon sx={{ fontSize: 22 }} />
  </Box>
)

const App: FunctionComponent = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
          ...(prefersDarkMode
            ? {
                background: {
                  default: '#0d1117',
                  paper: '#161b22',
                },
              }
            : {
                background: {
                  default: '#f5f7fa',
                  paper: '#ffffff',
                },
              }),
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        },
        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
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
    chorusSyncEnabled: false,
    chorusNoteDivision: '1/4',
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
          bpm: detectedBpm ?? settings.bpm,
          bpmDetected: detectedBpm,
        }))
      }

      // Rebuild chain to reflect any effect toggle changes
      rebuildChain()

      // Update effect parameters
      distortion.set({ distortion: settings.distortionDrive })
      reverb.set({ decay: settings.reverbDecay })
      const playbackRate = settings.speedEnabled ? settings.speed : 1
      const delayTime = settings.delaySyncEnabled
        ? noteToSeconds(settings.delayNoteDivision, settings.bpm) / playbackRate
        : settings.delayTime
      delay.set({ delayTime, feedback: settings.delayFeedback, wet: settings.delayWet })
      const chorusRate = settings.chorusSyncEnabled
        ? (1 / noteToSeconds(settings.chorusNoteDivision, settings.bpm)) * playbackRate
        : settings.chorusRate
      chorus.set({ frequency: chorusRate, depth: settings.chorusDepth })
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
        const playbackRate = settings.speedEnabled ? settings.speed : 1
        const delayTime = settings.delaySyncEnabled
          ? noteToSeconds(settings.delayNoteDivision, settings.bpm) / playbackRate
          : settings.delayTime
        const delay = new Tone.PingPongDelay(delayTime, settings.delayFeedback)
        delay.set({ wet: settings.delayWet })
        const chorusRate = settings.chorusSyncEnabled
          ? (1 / noteToSeconds(settings.chorusNoteDivision, settings.bpm)) * playbackRate
          : settings.chorusRate
        const chorus = new Tone.Chorus(chorusRate, 3.5, settings.chorusDepth)
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
        sx={{
          overflow: 'auto',
          bgcolor: 'background.default',
          py: 2,
        }}
      >

        <Card sx={{ maxWidth: 1400, width: '100%', mx: 2, p: 2, overflow: 'hidden' }}>
          <Box display="flex" alignItems="center" gap={1.5} sx={{ mb: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 18, color: '#fff' }} />
            </Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1 }}>scrunked</Typography>
            <Typography sx={{ fontSize: 12, mt: 0.25 }} color="text.secondary">a toolkit for ruining your favourite music</Typography>
          </Box>
          <CardContent sx={{ "&:last-child": { pb: 1 }, pt: 0 }}>
            <Grid container spacing={1}>
            <Grid item xs={11}>
              <Input type="file" sx={{ width: "100%", pt: 0.5, pb: 0.5 }} onChange={handleFileChange} accept={"audio/wav, audio/ogg, audio/mp3, audio/flac, audio/acc, audio/mpeg"} />
            </Grid>
            <Grid item xs={1}>
            <Tooltip title={settings.loop ? "Loop" : "Play Once"}>
              <Checkbox checked={settings.loop} icon={<ArrowRightAltIcon />} checkedIcon={<LoopIcon />} onChange={(evt) => set({...settings, loop: evt.currentTarget.checked})} />
              </Tooltip>
              </Grid>
            </Grid>




            {settings.file || settings.nextFile ? <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mt: 1,
                  mb: 0.5,
                  bgcolor: 'action.hover',
                  borderRadius: 2,
                  p: 1.5,
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handlePlayPauseToggle}
                  sx={{
                    minWidth: 48,
                    minHeight: 48,
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    flexShrink: 0,
                    p: 0,
                  }}
                >
                  {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </Button>

                <Box sx={{ flex: 1, minWidth: 0 }} ref={waveformRef} />

                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  color="text.secondary"
                >
                  {Duration.fromObject({ seconds: settings.duration }).toFormat("mm:ss")}
                </Typography>

                <Tooltip title="Export processed audio as WAV">
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleExport}
                      disabled={isExporting || !settings.file}
                      sx={{ minWidth: 36, minHeight: 36, borderRadius: '50%', p: 0 }}
                    >
                      {isExporting ? "..." : <FileDownloadIcon sx={{ fontSize: 18 }} />}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
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
                  <Typography variant="caption" sx={{ fontSize: 10, color: '#4caf50', ml: 0.5, fontWeight: 600 }}>
                    ✓ detected
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
              </Box>
            </Box>

            {/* Effects Section */}
            <Box
              display="flex"
              alignItems="center"
              sx={{ mt: 2, mb: 1.5 }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: 'text.secondary',
                }}
              >
                Effects Chain
              </Typography>
              <Box sx={{ flex: 1, ml: 1.5, height: 1, bgcolor: 'divider', opacity: 0.5 }} />
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
              <PipeConnector color={EFFECT_COLORS.speed} />
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
              <PipeConnector color={EFFECT_COLORS.distortion} />
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
              <PipeConnector color={EFFECT_COLORS.reverb} />
{/* Delay — with BPM sync */}
              <Card
                elevation={settings.delayEnabled ? 2 : 0}
                sx={{
                  minWidth: 120,
                  flex: '0 1 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  py: 1.5,
                  px: 0.5,
                  opacity: settings.delayEnabled ? 1 : 0.5,
                  border: '1px solid',
                  borderColor: settings.delayEnabled ? `${EFFECT_COLORS.delay}44` : 'divider',
                  borderLeft: 4,
                  borderLeftColor: EFFECT_COLORS.delay,
                  borderRadius: 2,
                  bgcolor: settings.delayEnabled ? `${EFFECT_COLORS.delay}08` : 'transparent',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    boxShadow: settings.delayEnabled ? 4 : 0,
                    bgcolor: settings.delayEnabled ? `${EFFECT_COLORS.delay}12` : 'action.hover',
                  },
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
                    <Slider
                      orientation="vertical"
                      value={NOTE_DIVISIONS.indexOf(settings.delayNoteDivision)}
                      max={NOTE_DIVISIONS.length - 1}
                      min={0}
                      step={1}
                      marks={NOTE_DIVISIONS.map((n, i) => ({ value: i, label: n }))}
                      sx={{ height: 120, mb: 0.25 }}
                      disabled={!settings.delayEnabled}
                      onChange={(_, value) => {
                        if (Array.isArray(value)) throw new Error('single value required')
                        const idx = value as number
                        set(mergeSettings({ delayNoteDivision: NOTE_DIVISIONS[idx] }))
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: 10 }}>
                      {noteToSeconds(settings.delayNoteDivision, settings.bpm).toFixed(3)}s
                    </Typography>
                  </>
                ) : (
                  <>
                    <Slider
                      orientation="vertical"
                      value={getScaleValue(settings.delayTime)}
                      max={getScaleValue(1)}
                      min={getScaleValue(0.01)}
                      step={0.001}
                      marks={[
                        { value: getScaleValue(0.05), label: "50ms" },
                        { value: getScaleValue(0.25), label: "250ms" },
                        { value: getScaleValue(0.5), label: "500ms" },
                        { value: getScaleValue(1), label: "1s" },
                      ]}
                      sx={{ height: 120, mb: 0.25 }}
                      disabled={!settings.delayEnabled}
                      onChange={(_, value) => {
                        if (Array.isArray(value)) throw new Error('single value required')
                        set(mergeSettings({ delayTime: getValueFromScale(value as number) }))
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: 11 }}>
                      {settings.delayTime.toFixed(3)}s
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
              <PipeConnector color={EFFECT_COLORS.delay} />
              
              {/* Chorus — with BPM sync */}
              <Card
                elevation={settings.chorusEnabled ? 2 : 0}
                sx={{
                  minWidth: 120,
                  flex: '0 1 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  py: 1.5,
                  px: 0.5,
                  opacity: settings.chorusEnabled ? 1 : 0.5,
                  border: '1px solid',
                  borderColor: settings.chorusEnabled ? `${EFFECT_COLORS.chorus}44` : 'divider',
                  borderLeft: 4,
                  borderLeftColor: EFFECT_COLORS.chorus,
                  borderRadius: 2,
                  bgcolor: settings.chorusEnabled ? `${EFFECT_COLORS.chorus}08` : 'transparent',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    boxShadow: settings.chorusEnabled ? 4 : 0,
                    bgcolor: settings.chorusEnabled ? `${EFFECT_COLORS.chorus}12` : 'action.hover',
                  },
                }}
              >
                <Box display="flex" alignItems="center" flexDirection="column" mb={0.5}>
                  <Tooltip title={EFFECT_TOOLTIPS.chorus} placement="top">
                    <Checkbox
                      checked={settings.chorusEnabled}
                      onChange={(e) => set(mergeSettings({ chorusEnabled: e.currentTarget.checked }))}
                      sx={{ py: 0, px: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }}
                      size="small"
                    />
                  </Tooltip>
                  <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.1, fontWeight: 500 }}>
                    Chorus
                  </Typography>
                </Box>
                {settings.chorusSyncEnabled ? (
                  <>
                    <Slider
                      orientation="vertical"
                      value={NOTE_DIVISIONS.indexOf(settings.chorusNoteDivision)}
                      max={NOTE_DIVISIONS.length - 1}
                      min={0}
                      step={1}
                      marks={NOTE_DIVISIONS.map((n, i) => ({ value: i, label: n }))}
                      sx={{ height: 120, mb: 0.25 }}
                      disabled={!settings.chorusEnabled}
                      onChange={(_, value) => {
                        if (Array.isArray(value)) throw new Error('single value required')
                        const idx = value as number
                        set(mergeSettings({ chorusNoteDivision: NOTE_DIVISIONS[idx] }))
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: 10 }}>
                      {noteToSeconds(settings.chorusNoteDivision, settings.bpm).toFixed(3)}s
                    </Typography>
                  </>
                ) : (
                  <>
                    <Slider
                      orientation="vertical"
                      value={getScaleValue(settings.chorusRate)}
                      max={getScaleValue(10)}
                      min={getScaleValue(0.1)}
                      step={0.001}
                      marks={[
                        { value: getScaleValue(0.5), label: "0.5" },
                        { value: getScaleValue(1), label: "1" },
                        { value: getScaleValue(4), label: "4" },
                        { value: getScaleValue(10), label: "10Hz" },
                      ]}
                      sx={{ height: 120, mb: 0.25 }}
                      disabled={!settings.chorusEnabled}
                      onChange={(_, value) => {
                        if (Array.isArray(value)) throw new Error('single value required')
                        set(mergeSettings({ chorusRate: getValueFromScale(value as number) }))
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: 11 }}>
                      {settings.chorusRate.toFixed(2)}hz
                    </Typography>
                  </>
                )}
                {/* Sync toggle */}
                <Tooltip title="Sync chorus rate to BPM">
                  <Button
                    size="small"
                    variant={settings.chorusSyncEnabled ? 'contained' : 'outlined'}
                    onClick={() => set(mergeSettings({ chorusSyncEnabled: !settings.chorusSyncEnabled }))}
                    sx={{
                      mt: 0.5,
                      fontSize: 9,
                      py: 0.1,
                      minWidth: 36,
                      lineHeight: 1.1,
                      color: settings.chorusSyncEnabled ? undefined : EFFECT_COLORS.chorus,
                      borderColor: EFFECT_COLORS.chorus,
                    }}
                  >
                    Sync
                  </Button>
                </Tooltip>
              </Card>
              <PipeConnector color={EFFECT_COLORS.chorus} />
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
              <PipeConnector color={EFFECT_COLORS.bitcrusher} />
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
            mt: 1.5,
            mb: 1,
            px: 2,
          }}
        >
          <Typography sx={{ fontSize: 12 }} color="text.secondary">
            Inspired by <Link href="https://github.com/dumbmatter/screw" sx={{ fontSize: 12 }}>Screw</Link> 🔩
          </Typography>
          <Typography sx={{ fontSize: 12, display: "flex", gap: 0.5, alignItems: 'center' }} color="text.secondary">
            Best in <SvgIcon fontSize='small'>{ChromeIcon}</SvgIcon> Chrome
          </Typography>
          <Changelog />
          <Button
            href={"https://github.com/rwnx/scrunked"}
            size="small"
            variant="text"
            sx={{ fontSize: 12, textTransform: 'none' }}
          >
            <GitHubIcon sx={{ mr: 0.5, fontSize: 14 }} />
            GitHub
          </Button>
        </Box>
      </Box>
    </ThemeProvider>
  </>
  );
}
const appNode = document.getElementById('app')
if (!appNode) throw new Error("unable to find app node")

render(<App />, appNode);
