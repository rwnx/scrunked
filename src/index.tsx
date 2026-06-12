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
import { getScaleValue, getValueFromScale, humanFormat } from './lib';
import WaveSurfer from 'wavesurfer.js';
import LoopIcon from '@mui/icons-material/Loop';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import {ChromeIcon} from "./icons"
import { SvgIcon } from '@mui/material';
import { QueryClientProvider, QueryClient } from 'react-query';

type Settings = {
  filterCutoff: number,
  file: File | undefined,
  duration: number | undefined
  nextFile: File | undefined,
  speed: number,
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
}

const FILTER_MAX = 22_000

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
    filterCutoff: FILTER_MAX,
    speed: 1,
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

  const [queryClient] = useState( new QueryClient({defaultOptions: {queries: {refetchOnWindowFocus: false}}}) )

  const waveformRef = useRef<HTMLDivElement | null>(null)
  const [waveform, setWaveform] = useState<WaveSurfer | undefined>()
  const [seekPosition, setSeekPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

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
    lastNode.connect(filter)
    filter.connect(comp)
    comp.connect(Tone.Destination)
  }, [settings.distortionEnabled, settings.reverbEnabled, settings.delayEnabled, settings.chorusEnabled, settings.bitcrusherEnabled, player, distortion, reverb, delay, chorus, bitcrusher, filter, comp])

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
        set(mergeSettings({ file: settings.nextFile, nextFile: undefined, duration: player.buffer.duration }))
      }

      // Rebuild chain to reflect any effect toggle changes
      rebuildChain()

      // Update effect parameters
      distortion.set({ distortion: settings.distortionDrive })
      reverb.set({ decay: settings.reverbDecay })
      delay.set({ delayTime: settings.delayTime, feedback: settings.delayFeedback, wet: settings.delayWet })
      chorus.set({ frequency: settings.chorusRate, depth: settings.chorusDepth })
      bitcrusher.set({ bits: settings.bitcrusherBits })

      filter.set({ frequency: settings.filterCutoff })
      player.set({ playbackRate: settings.speed, loop: settings.loop })
    }

    syncPlayerSettings()
  }, [throttledSettings, waveform, rebuildChain])


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

  return (<>
    <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
    <CssBaseline />
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
        minHeight="100vh"
      >

        <Card sx={{ width: 500, padding: 3 }}>
          <Typography variant="h5" component="div">scrunked</Typography>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>a toolkit for ruining your favourite music</Typography>
          <CardContent>
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
                  <Grid item xs={9}>
                    <Box sx={{ m: 1 }} ref={waveformRef}></Box>
                  </Grid>
                  <Grid item xs={1}>
                    <Box display="flex" height="100%" justifyContent="center" alignItems="center">
                      {Duration.fromObject({ seconds: settings.duration }).toFormat("mm:ss")}
                    </Box>
                  </Grid>
                </Grid>

            </> : null}

            <Grid container mt={2} spacing={2}>
              <Grid item xs={2}>Speed</Grid>
              <Grid item xs={9}>
                <Slider
                  value={settings.speed}
                  max={2}
                  min={0.1}
                  step={0.01}
                  marks={[
                    { value: 0.1 },
                    {value: 0.7334, label: "daycore"},
                    { value: 1, label: "1x" },
                    {value: 1.3636, label: "nightcore"},
                    { value: 2 },
                  ]}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ speed: value }))
                  }}
                />
              </Grid>
              <Grid item xs={1}>
                {Math.round(settings.speed*100)}%
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={2}><span>Filter</span></Grid>
              <Grid item xs={9}>
                <Slider
                  value={getScaleValue(settings.filterCutoff)}
                  max={filterCutoffMarks[filterCutoffMarks.length - 1].value}
                  min={1}
                  step={0.1}
                  marks={filterCutoffMarks}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ filterCutoff: getValueFromScale(value) }))
                  }}
                />
              </Grid>
              <Grid item xs={1}>
                {humanFormat(settings.filterCutoff)}hz
              </Grid>
            </Grid>

            {/* Effects Section */}
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }} color="text.secondary">Effects <span style={{ fontWeight: 'normal', fontSize: 12 }}>(toggle on/off to save CPU)</span></Typography>

            {/* Distortion */}
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={3}>
                <Checkbox size="small" checked={settings.distortionEnabled} onChange={(e) => set(mergeSettings({ distortionEnabled: e.currentTarget.checked }))} sx={{ py: 0 }} />
                <span style={{ fontSize: 13 }}>Distort</span>
              </Grid>
              <Grid item xs={7}>
                <Slider
                  value={settings.distortionDrive}
                  max={1}
                  min={0}
                  step={0.01}
                  size="small"
                  disabled={!settings.distortionEnabled}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ distortionDrive: value }))
                  }}
                />
              </Grid>
              <Grid item xs={2}>
                <span style={{ fontSize: 12 }}>{settings.distortionDrive.toFixed(2)}</span>
              </Grid>
            </Grid>

            {/* Reverb */}
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={3}>
                <Checkbox size="small" checked={settings.reverbEnabled} onChange={(e) => set(mergeSettings({ reverbEnabled: e.currentTarget.checked }))} sx={{ py: 0 }} />
                <span style={{ fontSize: 13 }}>Reverb</span>
              </Grid>
              <Grid item xs={7}>
                <Slider
                  value={settings.reverbDecay}
                  max={10}
                  min={0.1}
                  step={0.1}
                  size="small"
                  disabled={!settings.reverbEnabled}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ reverbDecay: value }))
                  }}
                />
              </Grid>
              <Grid item xs={2}>
                <span style={{ fontSize: 12 }}>{settings.reverbDecay.toFixed(1)}s</span>
              </Grid>
            </Grid>

            {/* PingPong Delay */}
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={3}>
                <Checkbox size="small" checked={settings.delayEnabled} onChange={(e) => set(mergeSettings({ delayEnabled: e.currentTarget.checked }))} sx={{ py: 0 }} />
                <span style={{ fontSize: 13 }}>Delay</span>
              </Grid>
              <Grid item xs={7}>
                <Slider
                  value={settings.delayTime}
                  max={1}
                  min={0.01}
                  step={0.01}
                  size="small"
                  disabled={!settings.delayEnabled}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ delayTime: value }))
                  }}
                />
              </Grid>
              <Grid item xs={2}>
                <span style={{ fontSize: 12 }}>{settings.delayTime.toFixed(2)}s</span>
              </Grid>
            </Grid>

            {/* Chorus */}
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={3}>
                <Checkbox size="small" checked={settings.chorusEnabled} onChange={(e) => set(mergeSettings({ chorusEnabled: e.currentTarget.checked }))} sx={{ py: 0 }} />
                <span style={{ fontSize: 13 }}>Chorus</span>
              </Grid>
              <Grid item xs={7}>
                <Slider
                  value={settings.chorusRate}
                  max={10}
                  min={0.1}
                  step={0.1}
                  size="small"
                  disabled={!settings.chorusEnabled}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ chorusRate: value }))
                  }}
                />
              </Grid>
              <Grid item xs={2}>
                <span style={{ fontSize: 12 }}>{settings.chorusRate.toFixed(1)}hz</span>
              </Grid>
            </Grid>

            {/* BitCrusher */}
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={3}>
                <Checkbox size="small" checked={settings.bitcrusherEnabled} onChange={(e) => set(mergeSettings({ bitcrusherEnabled: e.currentTarget.checked }))} sx={{ py: 0 }} />
                <span style={{ fontSize: 13 }}>Crush</span>
              </Grid>
              <Grid item xs={7}>
                <Slider
                  value={settings.bitcrusherBits}
                  max={16}
                  min={1}
                  step={1}
                  size="small"
                  marks={[
                    { value: 1, label: "1" },
                    { value: 8, label: "8" },
                    { value: 16, label: "16" },
                  ]}
                  disabled={!settings.bitcrusherEnabled}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ bitcrusherBits: value }))
                  }}
                />
              </Grid>
              <Grid item xs={2}>
                <span style={{ fontSize: 12 }}>{settings.bitcrusherBits}bit</span>
              </Grid>
            </Grid>

          </CardContent>
        </Card>
        <Typography sx={{ fontSize: 14, mt: 1 }} color="text.secondary">Inspired by <Link href="https://github.com/dumbmatter/screw">Screw</Link> 🔩 Built with love by <Link href="https://github.com/rwnx">Rowan</Link>✨</Typography>

        <Typography sx={{ fontSize: 14, mt: 1, display: "flex", gap: 0.5 }}color="text.secondary">Runs best in <SvgIcon fontSize='small'>{ChromeIcon}</SvgIcon> Chrome</Typography>
        <Changelog />
        <Typography sx={{ mt: 1 }} color="text.secondary"> <Button href={"https://github.com/rwnx/scrunked"}><GitHubIcon sx={{ mr: 0.5 }} />view on github</Button> </Typography>
      </Box>
    </ThemeProvider>
    </QueryClientProvider>
  </>
  );
}
const appNode = document.getElementById('app')
if (!appNode) throw new Error("unable to find app node")

render(<App />, appNode);
