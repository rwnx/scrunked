import { FunctionComponent } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as Tone from 'tone';
import { useThrottle } from '@uidotdev/usehooks';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import Input from '@mui/material/Input';
import Button from '@mui/material/Button';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LoopIcon from '@mui/icons-material/Loop';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import WaveSurfer from 'wavesurfer.js';

import EffectsChain from './components/EffectsChain';
import TransportBar from './components/TransportBar';
import FileDropArea from './components/FileDropArea';
import AppFooter from './components/AppFooter';
import {
  Settings, STORAGE_KEY, persistedSettingsSchema,
  FILTER_MAX, detectBpm, audioBufferToWavBlob, downloadBlob,
  noteToSeconds, noteToFrequency,
} from './types';

const mergeSettings = (next: Partial<Settings>) => (state: Settings) => ({ ...state, ...next })

function pickPersisted(settings: Settings) {
  return persistedSettingsSchema.parse(settings)
}

function loadPersistedSettings(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = persistedSettingsSchema.partial().parse(JSON.parse(raw))
    return parsed as Partial<Settings>
  } catch { return {} }
}

function savePersistedSettings(settings: Settings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pickPersisted(settings))) }
  catch { /* silently ignore */ }
}

const App: FunctionComponent = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const theme = useMemo(() => createTheme({
    palette: {
      mode: prefersDarkMode ? 'dark' : 'light',
      ...(prefersDarkMode
        ? { background: { default: '#0a0e17', paper: '#111827' } }
        : { background: { default: '#f0f2f5', paper: '#ffffff' } }),
    },
    shape: { borderRadius: 12 },
    typography: { fontFamily: '"Inter","Roboto","Helvetica","Arial",sans-serif' },
    components: { MuiCard: { styleOverrides: { root: { backgroundImage: 'none' } } } },
  }), [prefersDarkMode])

  const [settings, set] = useState<Settings>({
    speedEnabled: true, speed: 1, filterEnabled: true, filterCutoff: FILTER_MAX,
    loop: true, file: undefined, duration: undefined, nextFile: undefined, state: 'init',
    distortionEnabled: false, distortionDrive: 0.5,
    reverbEnabled: false, reverbDecay: 2,
    delayEnabled: false, delayTime: 0.25, delayFeedback: 0.3, delayWet: 0.5,
    chorusEnabled: false, chorusRate: 1.5, chorusDepth: 0.7,
    bitcrusherEnabled: false, bitcrusherBits: 8,
    tremoloEnabled: false, tremoloRate: 5, tremoloDepth: 0.5,
    phaserEnabled: false, phaserRate: 0.5, phaserDepth: 0.5, phaserFeedback: 0.3,
    autoPanEnabled: false, autoPanRate: 0.5, autoPanDepth: 0.5,
    bpm: 120, bpmDetected: null,
    delaySyncEnabled: false, delayNoteDivision: '1/4',
    phaserSyncEnabled: false, phaserNoteDivision: '1/4',
    tremoloSyncEnabled: false, tremoloNoteDivision: '1/4',
    chorusSyncEnabled: false, chorusNoteDivision: '1/4',
    reverbSyncEnabled: false, reverbNoteDivision: '1/4',
    autoPanSyncEnabled: false, autoPanNoteDivision: '1/4',
    ...loadPersistedSettings(),
  })
  const onUpdate = useCallback((partial: Partial<Settings>) => { set(mergeSettings(partial)) }, [])
  const throttledSettings = useThrottle(settings, 250)

  const [player] = useState(() => new Tone.Player())
  const [filterNode] = useState(() => new Tone.Filter(settings.filterCutoff, 'lowpass', -48))
  const [comp] = useState(() => new Tone.Compressor(-24, 12))
  const [distortion] = useState(() => new Tone.Distortion(0.5))
  const [reverb] = useState(() => new Tone.Reverb({ decay: 2 }))
  const [delay] = useState(() => new Tone.PingPongDelay(0.25, 0.3))
  const [chorus] = useState(() => new Tone.Chorus(1.5, 3.5, 0.7))
  const [bitcrusher] = useState(() => new Tone.BitCrusher(8))
  const [tremolo] = useState(() => new Tone.Tremolo(5, 0.5))
  const [phaser] = useState(() => new Tone.Phaser({ frequency: 0.5, octaves: 5, baseFrequency: 500 }))
  const [autoPan] = useState(() => new Tone.AutoPanner(0.5))

  const waveformRef = useRef<HTMLDivElement | null>(null)
  const [waveform, setWaveform] = useState<WaveSurfer | undefined>()
  const [seekPosition, setSeekPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const playbackStartTimeRef = useRef(0)
  const playbackOffsetRef = useRef(0)

  const rebuildChain = useCallback(() => {
    try { (chorus as any).stop() } catch {}
    try { (tremolo as any).stop() } catch {}
    try { (autoPan as any).stop() } catch {}
    for (const n of [player, distortion, phaser, tremolo, reverb, delay, chorus, bitcrusher, filterNode, comp, autoPan]) {
      try { n.disconnect() } catch {}
    }
    let last: Tone.ToneAudioNode = player
    if (settings.distortionEnabled) { last.connect(distortion); last = distortion }
    if (settings.phaserEnabled) { last.connect(phaser); last = phaser }
    if (settings.tremoloEnabled) { last.connect(tremolo); try { (tremolo as any).start() } catch {}; last = tremolo }
    if (settings.reverbEnabled) { last.connect(reverb); last = reverb }
    if (settings.delayEnabled) { last.connect(delay); last = delay }
    if (settings.chorusEnabled) { last.connect(chorus); try { (chorus as any).start() } catch {}; last = chorus }
    if (settings.bitcrusherEnabled) { last.connect(bitcrusher); last = bitcrusher }
    if (settings.filterEnabled) { last.connect(filterNode); last = filterNode }
    if (settings.autoPanEnabled) { last.connect(autoPan); try { (autoPan as any).start() } catch {}; last = autoPan }
    last.connect(comp)
    comp.connect(Tone.Destination)
  }, [settings.distortionEnabled, settings.phaserEnabled, settings.tremoloEnabled, settings.reverbEnabled, settings.delayEnabled, settings.chorusEnabled, settings.bitcrusherEnabled, settings.filterEnabled, settings.autoPanEnabled, player, distortion, phaser, tremolo, reverb, delay, chorus, bitcrusher, filterNode, comp, autoPan])

  useEffect(() => {
    if (!waveformRef.current) return
    if (waveform) waveform.destroy()
    const ws = WaveSurfer.create({
      container: waveformRef.current, height: 80,
      waveColor: theme.palette.primary.main,
      progressColor: theme.palette.text.secondary,
      cursorWidth: 0, interact: true,
    })
    ws.on('interaction', (newTime: number) => {
      setSeekPosition(newTime)
      if (player.state === 'started') {
        player.stop(); player.start(0, newTime)
        playbackStartTimeRef.current = Tone.now()
        playbackOffsetRef.current = newTime
      }
    })
    setWaveform(ws)
    return () => { ws.destroy() }
  }, [waveformRef.current])

  useEffect(() => {
    if (!waveform || !settings.duration) return
    const interval = setInterval(() => {
      if (player.state === 'started' && settings.duration) {
        const elapsed = Tone.now() - playbackStartTimeRef.current
        const pos = Math.min(playbackOffsetRef.current + elapsed, settings.duration)
        waveform.seekTo(pos / settings.duration)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [waveform, isPlaying, settings.duration])

  useEffect(() => {
    async function sync() {
      if (settings.state === 'init') {
        rebuildChain()
        set(s => ({ ...s, state: 'ready' }))
        return
      }
      if (settings.nextFile) {
        waveform?.loadBlob(settings.nextFile)
        const url = URL.createObjectURL(settings.nextFile)
        player.stop(); await player.load(url); player.start()
        playbackStartTimeRef.current = Tone.now()
        playbackOffsetRef.current = 0
        setSeekPosition(0); setIsPlaying(true)
        const dur = player.buffer.duration
        let bpmDetected: number | null = null
        try {
          const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(
            await settings.nextFile.arrayBuffer()
          )
          bpmDetected = detectBpm(buf)
        } catch (e) { console.warn('BPM detection failed:', e) }
        onUpdate({ file: settings.nextFile, nextFile: undefined, duration: dur, bpmDetected })
      }
      rebuildChain()
      distortion.set({ distortion: settings.distortionDrive })
      reverb.set({ decay: settings.reverbSyncEnabled ? noteToSeconds(settings.reverbNoteDivision, settings.bpm) : settings.reverbDecay })
      const dt = settings.delaySyncEnabled ? noteToSeconds(settings.delayNoteDivision, settings.bpm) : settings.delayTime
      delay.set({ delayTime: dt, feedback: settings.delayFeedback, wet: settings.delayWet })
      chorus.set({ frequency: settings.chorusSyncEnabled ? noteToFrequency(settings.chorusNoteDivision, settings.bpm) : settings.chorusRate, depth: settings.chorusDepth })
      bitcrusher.set({ bits: settings.bitcrusherBits })
      tremolo.set({ frequency: settings.tremoloSyncEnabled ? noteToFrequency(settings.tremoloNoteDivision, settings.bpm) : settings.tremoloRate, depth: settings.tremoloDepth })
      phaser.set({ frequency: settings.phaserSyncEnabled ? noteToFrequency(settings.phaserNoteDivision, settings.bpm) : settings.phaserRate })
      autoPan.set({ frequency: settings.autoPanSyncEnabled ? noteToFrequency(settings.autoPanNoteDivision, settings.bpm) : settings.autoPanRate, depth: settings.autoPanDepth })
      player.set({ playbackRate: settings.speedEnabled ? settings.speed : 1, loop: settings.loop })
      filterNode.set({ frequency: settings.filterCutoff })
    }
    sync()
  }, [throttledSettings, waveform, rebuildChain])

  useEffect(() => { savePersistedSettings(settings) }, [settings])

  const handlePlayPause = () => {
    if (!player) return
    if (player.state === 'started') {
      player.stop()
      if (settings.duration) {
        const elapsed = Tone.now() - playbackStartTimeRef.current
        setSeekPosition(Math.min(playbackOffsetRef.current + elapsed, settings.duration))
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
    const buf = player.buffer?.get()
    if (!buf || !settings.duration) return
    setIsExporting(true)
    try {
      const dur = settings.duration / settings.speed
      const result = await Tone.Offline(async () => {
        const p = new Tone.Player(buf)
        const f = new Tone.Filter(settings.filterCutoff, 'lowpass', -48)
        const c = new Tone.Compressor(-24, 12)
        const d = new Tone.Distortion(settings.distortionDrive)
        const r = new Tone.Reverb({ decay: settings.reverbSyncEnabled ? noteToSeconds(settings.reverbNoteDivision, settings.bpm) : settings.reverbDecay })
        await r.ready
        const dt = settings.delaySyncEnabled ? noteToSeconds(settings.delayNoteDivision, settings.bpm) : settings.delayTime
        const dl = new Tone.PingPongDelay(dt, settings.delayFeedback)
        dl.set({ wet: settings.delayWet })
        const cr = settings.chorusSyncEnabled ? noteToFrequency(settings.chorusNoteDivision, settings.bpm) : settings.chorusRate
        const ch = new Tone.Chorus(cr, 3.5, settings.chorusDepth)
        const bc = new Tone.BitCrusher(settings.bitcrusherBits)
        const tr = new Tone.Tremolo(settings.tremoloSyncEnabled ? noteToFrequency(settings.tremoloNoteDivision, settings.bpm) : settings.tremoloRate, settings.tremoloDepth)
        const ph = new Tone.Phaser({ frequency: settings.phaserSyncEnabled ? noteToFrequency(settings.phaserNoteDivision, settings.bpm) : settings.phaserRate, octaves: 5, baseFrequency: 500 })
        const ap = new Tone.AutoPanner(settings.autoPanSyncEnabled ? noteToFrequency(settings.autoPanNoteDivision, settings.bpm) : settings.autoPanRate)
        ap.set({ depth: settings.autoPanDepth })
        let last: Tone.ToneAudioNode = p
        if (settings.distortionEnabled) { last.connect(d); last = d }
        if (settings.phaserEnabled) { last.connect(ph); last = ph }
        if (settings.tremoloEnabled) { last.connect(tr); try { (tr as any).start() } catch {}; last = tr }
        if (settings.reverbEnabled) { last.connect(r); last = r }
        if (settings.delayEnabled) { last.connect(dl); last = dl }
        if (settings.chorusEnabled) { last.connect(ch); try { (ch as any).start() } catch {}; last = ch }
        if (settings.bitcrusherEnabled) { last.connect(bc); last = bc }
        last.connect(f)
        if (settings.autoPanEnabled) { f.connect(ap); last = ap }
        last.connect(c); c.toDestination()
        p.loop = false; p.playbackRate = settings.speed; p.start(0)
      }, dur)
      const wavBlob = audioBufferToWavBlob(result.get()!)
      const baseName = settings.file!.name.replace(/\.[^/.]+$/, '')
      downloadBlob(wavBlob, baseName + '_scrunked.wav')
    } catch (err) { console.error('Export failed:', err) }
    finally { setIsExporting(false) }
  }

  const hasFile = !!(settings.file || settings.nextFile)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" minHeight="100dvh" sx={{ overflow: 'auto', bgcolor: 'background.default', py: 2 }}>
        <Card sx={{ maxWidth: 1400, width: '100%', mx: 2, p: 2.5, overflow: 'hidden' }}>
          <Box display="flex" alignItems="center" gap={1.5} sx={{ mb: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <PlayArrowIcon sx={{ fontSize: 20, color: '#fff' }} />
            </Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1, letterSpacing: -0.3 }}>scrunked</Typography>
            <Typography sx={{ fontSize: 12, mt: 0.25 }} color="text.secondary">a toolkit for ruining your favourite music</Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={settings.loop ? 'Loop' : 'Play Once'}>
              <Checkbox checked={settings.loop} icon={<ArrowRightAltIcon />} checkedIcon={<LoopIcon />} onChange={(e) => onUpdate({ loop: e.currentTarget.checked })} sx={{ '& .MuiSvgIcon-root': { fontSize: 22 } }} />
            </Tooltip>
          </Box>
          <FileDropArea hasFile={hasFile} fileName={settings.file?.name} onFile={(file) => onUpdate({ nextFile: file })} />
          <TransportBar isPlaying={isPlaying} isExporting={isExporting} duration={settings.duration} hasFile={hasFile} waveformRef={waveformRef} onPlayPause={handlePlayPause} onExport={handleExport} />
          {hasFile && (
            <Box display="flex" alignItems="center" sx={{ mt: 1, mb: 1.5, gap: 1.5 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, fontSize: 12 }}>Tempo</Typography>
              <Box display="flex" alignItems="center" gap={0.5} sx={{ px: 1, py: 0.3, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{settings.bpm}</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary' }}>bpm</Typography>
                {settings.bpmDetected !== null && (
                  <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', ml: 0.5 }}>
                    {settings.bpmDetected === settings.bpm ? '✓ detected' : `(detected ${settings.bpmDetected})`}
                  </Typography>
                )}
              </Box>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Input type="number" value={settings.bpm} onChange={(e: any) => { const v = parseInt(e.currentTarget.value, 10); if (!isNaN(v) && v >= 40 && v <= 300) onUpdate({ bpm: v }) }}
                  sx={{ width: 60, '& input': { fontSize: 12, py: 0.3, textAlign: 'center' } }} inputProps={{ min: 40, max: 300, step: 1 }} />
                <Button size="small" variant="outlined" sx={{ fontSize: 10, py: 0.2, minWidth: 0, whiteSpace: 'nowrap' }}
                  onClick={() => { if (settings.bpmDetected) onUpdate({ bpm: settings.bpmDetected }) }} disabled={!settings.bpmDetected}>Apply</Button>
              </Box>
            </Box>
          )}
          <EffectsChain settings={settings} onUpdate={onUpdate} />
        </Card>
        <AppFooter />
      </Box>
    </ThemeProvider>
  )
}

export default App
