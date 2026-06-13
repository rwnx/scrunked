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
  noteToSeconds, noteToFrequency, CHAINABLE_EFFECTS, createDefaultInstance,
} from './types';
import type { EffectType, EffectInstance } from './types';

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

/** Create a Tone.js node from an effect instance. */
function createNode(instance: { type: EffectType; params: any }): Tone.ToneAudioNode {
  const p = instance.params
  switch (instance.type) {
    case 'distortion': return new Tone.Distortion(p.drive)
    case 'phaser':     return new Tone.Phaser({ frequency: p.rate, octaves: 5, baseFrequency: 500 })
    case 'tremolo':    return new Tone.Tremolo(p.rate, p.depth)
    case 'reverb':     return new Tone.Reverb({ decay: p.decay })
    case 'delay':      return new Tone.PingPongDelay(p.time, p.feedback)
    case 'chorus':     return new Tone.Chorus(p.rate, 3.5, p.depth)
    case 'bitcrusher': return new Tone.BitCrusher(p.bits)
    case 'filter':     return new Tone.Filter(p.cutoff, 'lowpass', -48)
    case 'autoPan':    return new Tone.AutoPanner(p.rate)
    default:           throw new Error(`no node for ${instance.type}`)
  }
}

/** Apply parameters from an effect instance to its node. */
function applyParams(instance: { type: EffectType; params: any }, node: Tone.ToneAudioNode, bpm: number): void {
  const p = instance.params
  switch (instance.type) {
    case 'distortion': (node as Tone.Distortion).set({ distortion: p.drive }); break
    case 'phaser':     (node as Tone.Phaser).set({ frequency: p.syncEnabled ? noteToFrequency(p.noteDivision, bpm) : p.rate }); break
    case 'tremolo':    (node as Tone.Tremolo).set({ frequency: p.syncEnabled ? noteToFrequency(p.noteDivision, bpm) : p.rate, depth: p.depth }); break
    case 'reverb':     (node as Tone.Reverb).set({ decay: p.syncEnabled ? noteToSeconds(p.noteDivision, bpm) : p.decay }); break
    case 'delay': {
      const dt = p.syncEnabled ? noteToSeconds(p.noteDivision, bpm) : p.time
      ;(node as Tone.PingPongDelay).set({ delayTime: dt, feedback: p.feedback, wet: p.wet })
      break
    }
    case 'chorus':     (node as Tone.Chorus).set({ frequency: p.syncEnabled ? noteToFrequency(p.noteDivision, bpm) : p.rate, depth: p.depth }); break
    case 'bitcrusher': (node as Tone.BitCrusher).set({ bits: p.bits }); break
    case 'filter':     (node as Tone.Filter).set({ frequency: p.cutoff }); break
    case 'autoPan':    (node as Tone.AutoPanner).set({ frequency: p.syncEnabled ? noteToFrequency(p.noteDivision, bpm) : p.rate, depth: p.depth }); break
  }
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

  const persisted = loadPersistedSettings()
  const [settings, set] = useState<Settings>({
    effectInstances: CHAINABLE_EFFECTS.map((t) => createDefaultInstance(t)),
    loop: true, file: undefined, duration: undefined, nextFile: undefined, state: 'init',
    bpm: 120, bpmDetected: null, speedEnabled: true, speed: 1, reverseEnabled: false,
    ...persisted,
  })
  const onUpdate = useCallback((partial: Partial<Settings>) => { set(mergeSettings(partial)) }, [])
  const throttledSettings = useThrottle(settings, 250)

  const [player] = useState(() => new Tone.Player())
  const [comp] = useState(() => new Tone.Compressor(-24, 12))
  /** Map of instance ID → Tone.js audio node (dynamically created/destroyed). */
  const nodesRef = useRef<Map<string, Tone.ToneAudioNode>>(new Map())

  const waveformRef = useRef<HTMLDivElement | null>(null)
  const [waveform, setWaveform] = useState<WaveSurfer | undefined>()
  const [seekPosition, setSeekPosition] = useState(0)
  const [reverseProgress, setReverseProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const playbackStartTimeRef = useRef(0)
  const playbackOffsetRef = useRef(0)
  /** Tracks the chain topology key to avoid rebuilding the chain on param-only changes. */
  const topologyKeyRef = useRef('')

  // ── Dynamic node sync (create/destroy/apply params) ────────────────
  const syncNodes = useCallback((instances: Settings['effectInstances'], bpm: number) => {
    const nodes = nodesRef.current
    const neededIds = new Set(instances.map((i) => i.id))
    for (const [id, node] of nodes) {
      if (!neededIds.has(id)) {
        try { (node as any).dispose() } catch {}
        nodes.delete(id)
      }
    }
    for (const inst of instances) {
      if (nodes.has(inst.id)) continue
      const node = createNode(inst)
      if (inst.type === 'chorus' || inst.type === 'tremolo' || inst.type === 'autoPan') {
        try { (node as any).start() } catch {}
      }
      nodes.set(inst.id, node)
    }
    for (const inst of instances) {
      const node = nodes.get(inst.id)
      if (node) applyParams(inst, node, bpm)
    }
  }, [])

  // ── Rebuild audio chain ─────────────────────────────────────────────
  const rebuildChain = useCallback(() => {
    const nodes = nodesRef.current
    for (const [, node] of nodes) { try { node.disconnect() } catch {} }
    try { player.disconnect() } catch {}
    try { comp.disconnect() } catch {}
    let last: Tone.ToneAudioNode = player
    for (const inst of settings.effectInstances) {
      if (!inst.params.enabled) continue
      const node = nodes.get(inst.id)
      if (node) { last.connect(node); last = node }
    }
    last.connect(comp)
    comp.connect(Tone.Destination)
  }, [settings.effectInstances, player, comp])

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

  /** Simple reverse toggle — locked at the start of the effects panel. */
  const isReverseActive = settings.reverseEnabled

  useEffect(() => {
    if (!waveform || !settings.duration) return
    const interval = setInterval(() => {
      if (player.state === 'started' && settings.duration) {
        const elapsed = Tone.now() - playbackStartTimeRef.current
        let pos: number
        let revProgress = 0
        if (isReverseActive) {
          pos = playbackOffsetRef.current - elapsed
          if (pos <= 0) {
            if (settings.loop) {
              pos += settings.duration
              playbackOffsetRef.current = pos
              playbackStartTimeRef.current = Tone.now()
              player.stop(); player.start(0, pos)
            } else {
              pos = 0
              player.stop()
              setIsPlaying(false)
            }
          }
          revProgress = (playbackOffsetRef.current - pos) / Math.max(0.001, playbackOffsetRef.current)
          setReverseProgress(Math.min(1, revProgress))
        } else {
          pos = Math.min(playbackOffsetRef.current + elapsed, settings.duration)
        }
        waveform.seekTo(pos / settings.duration)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [waveform, isPlaying, settings.duration, isReverseActive])

  useEffect(() => {
    let cancelled = false
    async function sync() {
      if (settings.state === 'init') {
        syncNodes(settings.effectInstances, settings.bpm)
        rebuildChain()
        if (!cancelled) set(s => ({ ...s, state: 'ready' }))
        return
      }
      if (settings.nextFile) {
        waveform?.loadBlob(settings.nextFile)
        const url = URL.createObjectURL(settings.nextFile)
        player.stop(); await player.load(url); player.start()
        playbackStartTimeRef.current = Tone.now()
        playbackOffsetRef.current = 0
        setSeekPosition(0); setIsPlaying(true); setReverseProgress(0)
        const dur = player.buffer.duration
        let bpmDetected: number | null = null
        try {
          const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(
            await settings.nextFile.arrayBuffer()
          )
          bpmDetected = detectBpm(buf)
        } catch (e) { console.warn('BPM detection failed:', e) }
        if (!cancelled) {
          onUpdate({ file: settings.nextFile, nextFile: undefined, duration: dur, bpmDetected, ...(bpmDetected !== null ? { bpm: bpmDetected } : {}) })
        }
      }
      syncNodes(settings.effectInstances, settings.bpm)
      // Only rebuild chain when topology changes (instances added/removed/reordered/enable toggled)
      const newKey = settings.effectInstances.map((i) => `${i.id}:${i.params.enabled}`).join('|')
      if (newKey !== topologyKeyRef.current) {
        topologyKeyRef.current = newKey
        rebuildChain()
      }
      // Speed & reverse — locked one-off controls at the top of the effects panel
      player.set({ playbackRate: settings.speedEnabled ? settings.speed : 1, loop: settings.loop })
      player.reverse = settings.reverseEnabled
    }
    sync()
    return () => { cancelled = true }
  // Intentionally omitting rebuildChain from deps — we call it conditionally
  // based on the topology key, and throttledSettings ensures fresh closures.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [throttledSettings, waveform, syncNodes, player, onUpdate])

  useEffect(() => { savePersistedSettings(settings) }, [settings])

  const handlePlayPause = () => {
    if (!player) return
    if (player.state === 'started') {
      player.stop()
      if (settings.duration) {
        const elapsed = Tone.now() - playbackStartTimeRef.current
        setSeekPosition(isReverseActive
          ? Math.max(0, playbackOffsetRef.current - elapsed)
          : Math.min(playbackOffsetRef.current + elapsed, settings.duration))
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
      const effectiveSpeed = settings.speedEnabled ? settings.speed : 1
      const dur = settings.duration / effectiveSpeed
      const result = await Tone.Offline(async () => {
        const p = new Tone.Player(buf)
        const c = new Tone.Compressor(-24, 12)
        let last: Tone.ToneAudioNode = p
        for (const inst of settings.effectInstances) {
          if (!inst.params.enabled) continue
          const node = createNode(inst)
          if (inst.type === 'chorus' || inst.type === 'tremolo' || inst.type === 'autoPan') {
            try { (node as any).start() } catch {}
          }
          if (inst.type === 'reverb') await (node as Tone.Reverb).ready
          applyParams(inst, node, settings.bpm)
          last.connect(node)
          last = node
        }
        last.connect(c)
        c.toDestination()
        p.loop = false; p.playbackRate = effectiveSpeed; p.reverse = settings.reverseEnabled; p.start(0)
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
        <Card sx={{ maxWidth: 1400, width: '100%', mx: { xs: 1, sm: 2 }, p: { xs: 1.5, sm: 2.5 }, overflow: 'hidden' }}>
          <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <PlayArrowIcon sx={{ fontSize: 20, color: '#fff' }} />
            </Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1, letterSpacing: -0.3, flexShrink: 0 }}>scrunked</Typography>
            <Typography sx={{ fontSize: 12, mt: 0.25, minWidth: { xs: '100%', sm: 0 }, order: { xs: 1, sm: 0 } }} color="text.secondary">a toolkit for ruining your favourite music</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }} />
            <Tooltip title={settings.loop ? 'Loop' : 'Play Once'}>
              <Checkbox checked={settings.loop} icon={<ArrowRightAltIcon />} checkedIcon={<LoopIcon />} onChange={(e) => onUpdate({ loop: e.currentTarget.checked })} sx={{ '& .MuiSvgIcon-root': { fontSize: 22 } }} />
            </Tooltip>
          </Box>
          <FileDropArea hasFile={hasFile} fileName={settings.file?.name} onFile={(file) => onUpdate({ nextFile: file })} />
          <TransportBar isPlaying={isPlaying} isExporting={isExporting} duration={settings.duration} hasFile={hasFile} waveformRef={waveformRef} onPlayPause={handlePlayPause} onExport={handleExport} reverseEnabled={isReverseActive} reverseProgress={reverseProgress} />
          {hasFile && (
            <Box display="flex" alignItems="center" flexWrap="wrap" sx={{ mt: 1, mb: 1.5, gap: { xs: 1, sm: 1.5 } }}>
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
