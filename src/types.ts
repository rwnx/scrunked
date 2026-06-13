import { z } from 'zod';
import {
  getScaleValue, getValueFromScale, humanFormat,
  noteToSeconds, noteToFrequency, formatNoteDivision,
  detectBpm, audioBufferToWavBlob, downloadBlob
} from './lib';

export type NoteDivision = (typeof NOTE_DIVISIONS)[number]

export const NOTE_DIVISIONS = [
  '1/64', '1/32', '1/16', '1/8', '1/4', '1/2', '1/1',
  '1/8.', '1/4.', '1/2.', '1/1.',
  '1/8t', '1/4t', '1/2t', '1/1t',
] as const
export const FILTER_MAX = 22_000
export const STORAGE_KEY = "scrunked:settings"

export type SnapSettings = {
  syncEnabled: boolean;
  noteDivision: NoteDivision;
}

/** Effect types available as chainable instances (speed & reverse are standalone). */
export const CHAINABLE_EFFECTS = [
  'distortion', 'phaser', 'tremolo', 'reverb',
  'delay', 'chorus', 'bitcrusher', 'filter', 'autoPan',
] as const

/** Standalone controls rendered as locked bars above the effects grid. */
export const STANDALONE_EFFECTS = ['speed', 'reverse'] as const

/** Full ordered list including all effect names for chain display. */
export const DEFAULT_EFFECT_ORDER = [
  ...STANDALONE_EFFECTS, ...CHAINABLE_EFFECTS,
] as const

/** Union of all effect names for display/lookup purposes (colors, tooltips, labels). */
export type AllEffectType = (typeof DEFAULT_EFFECT_ORDER)[number]

/** Union of chainable effect types — speed & reverse are not in this set. */
export type EffectType = (typeof CHAINABLE_EFFECTS)[number]

/**
 * Per-effect-type parameter interfaces for chainable effects.
 * Speed and reverse are standalone controls at the top (not in the chain grid).
 */
export type EffectParams = {
  distortion: { enabled: boolean; drive: number }
  phaser: { enabled: boolean; rate: number; depth: number; feedback: number; syncEnabled: boolean; noteDivision: NoteDivision }
  tremolo: { enabled: boolean; rate: number; depth: number; syncEnabled: boolean; noteDivision: NoteDivision }
  reverb: { enabled: boolean; decay: number; syncEnabled: boolean; noteDivision: NoteDivision }
  delay: { enabled: boolean; time: number; feedback: number; wet: number; syncEnabled: boolean; noteDivision: NoteDivision }
  chorus: { enabled: boolean; rate: number; depth: number; syncEnabled: boolean; noteDivision: NoteDivision }
  bitcrusher: { enabled: boolean; bits: number }
  filter: { enabled: boolean; cutoff: number }
  autoPan: { enabled: boolean; rate: number; depth: number; syncEnabled: boolean; noteDivision: NoteDivision }
}

/** A single effect instance in the chain — type-safe params via discriminated union. */
export type EffectInstance<T extends EffectType = EffectType> = {
  id: string
  type: T
  params: EffectParams[T]
}

/** Simplified top-level settings — effect params live per-instance. */
export type Settings = {
  effectInstances: EffectInstance[]
  speedEnabled: boolean
  speed: number
  reverseEnabled: boolean
  file: File | undefined
  duration: number | undefined
  nextFile: File | undefined
  loop: boolean
  state: "ready" | "init"
  bpm: number
  bpmDetected: number | null
}

/** Create a default EffectInstance for a given type with a unique ID. */
let _idCounter = 0
export function createDefaultInstance(type: EffectType, id?: string): EffectInstance {
  const instanceId = id || `${type}--${++_idCounter}`
  const n = (v: NoteDivision): NoteDivision => v
  switch (type) {
    case 'distortion': return { id: instanceId, type: 'distortion', params: { enabled: false, drive: 0.5 } }
    case 'phaser':     return { id: instanceId, type: 'phaser',     params: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.3, syncEnabled: false, noteDivision: n('1/4') } }
    case 'tremolo':    return { id: instanceId, type: 'tremolo',    params: { enabled: false, rate: 5, depth: 0.5, syncEnabled: false, noteDivision: n('1/4') } }
    case 'reverb':     return { id: instanceId, type: 'reverb',     params: { enabled: false, decay: 2, syncEnabled: false, noteDivision: n('1/4') } }
    case 'delay':      return { id: instanceId, type: 'delay',      params: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.5, syncEnabled: false, noteDivision: n('1/4') } }
    case 'chorus':     return { id: instanceId, type: 'chorus',     params: { enabled: false, rate: 1.5, depth: 0.7, syncEnabled: false, noteDivision: n('1/4') } }
    case 'bitcrusher': return { id: instanceId, type: 'bitcrusher', params: { enabled: false, bits: 8 } }
    case 'filter':     return { id: instanceId, type: 'filter',     params: { enabled: true, cutoff: FILTER_MAX } }
    case 'autoPan':    return { id: instanceId, type: 'autoPan',    params: { enabled: false, rate: 0.5, depth: 0.5, syncEnabled: false, noteDivision: n('1/4') } }
  }
}

export const EFFECT_COLORS = {
  speed: '#4fc3f7',
  distortion: '#ef5350',
  phaser: '#ff7043',
  tremolo: '#ab47bc',
  reverb: '#66bb6a',
  delay: '#26a69a',
  chorus: '#7e57c2',
  bitcrusher: '#ffa726',
  filter: '#42a5f5',
  autoPan: '#ec407a',
  reverse: '#f48fb1',
} as const

export const EFFECT_TOOLTIPS: Record<string, string> = {
  distortion: 'Adds grit by clipping the waveform. Turn up for aggressive, warm saturation.',
  phaser: 'Sweeping notch filter that creates a whooshing, psychedelic effect.',
  tremolo: 'Rhythmic volume modulation for a pulsing, tremulous sound.',
  reverb: 'Simulates acoustic space — larger decay = bigger room.',
  delay: 'Echo effect with ping-pong stereo panning. Time, feedback, and mix controls.',
  chorus: 'Thickens sound by doubling with modulation. Creates a swirling, lush texture.',
  bitcrusher: 'Reduces audio resolution for lo-fi digital artifacts. Lower bits = more crunch.',
  filter: 'Low-pass filter — cuts high frequencies for a darker, muffled sound.',
  speed: 'Changes playback speed (tempo and pitch together, like a tape player).',
  autoPan: 'Automatically pans the audio left and right for stereo movement.',
  reverse: 'Plays the audio backwards — turn on to hear your track in reverse.',
}

/** Zod schema for a single effect instance — persisted across sessions. */
const effectInstanceSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('distortion'), params: z.object({ enabled: z.boolean(), drive: z.number() }) }),
  z.object({ id: z.string(), type: z.literal('phaser'),     params: z.object({ enabled: z.boolean(), rate: z.number(), depth: z.number(), feedback: z.number(), syncEnabled: z.boolean(), noteDivision: z.string() }) }),
  z.object({ id: z.string(), type: z.literal('tremolo'),    params: z.object({ enabled: z.boolean(), rate: z.number(), depth: z.number(), syncEnabled: z.boolean(), noteDivision: z.string() }) }),
  z.object({ id: z.string(), type: z.literal('reverb'),     params: z.object({ enabled: z.boolean(), decay: z.number(), syncEnabled: z.boolean(), noteDivision: z.string() }) }),
  z.object({ id: z.string(), type: z.literal('delay'),      params: z.object({ enabled: z.boolean(), time: z.number(), feedback: z.number(), wet: z.number(), syncEnabled: z.boolean(), noteDivision: z.string() }) }),
  z.object({ id: z.string(), type: z.literal('chorus'),     params: z.object({ enabled: z.boolean(), rate: z.number(), depth: z.number(), syncEnabled: z.boolean(), noteDivision: z.string() }) }),
  z.object({ id: z.string(), type: z.literal('bitcrusher'), params: z.object({ enabled: z.boolean(), bits: z.number() }) }),
  z.object({ id: z.string(), type: z.literal('filter'),     params: z.object({ enabled: z.boolean(), cutoff: z.number() }) }),
  z.object({ id: z.string(), type: z.literal('autoPan'),    params: z.object({ enabled: z.boolean(), rate: z.number(), depth: z.number(), syncEnabled: z.boolean(), noteDivision: z.string() }) }),
])

export const persistedSettingsSchema = z.object({
  effectInstances: z.array(effectInstanceSchema),
  loop: z.boolean(),
  bpm: z.number(),
  speedEnabled: z.boolean().optional(),
  speed: z.number().optional(),
  reverseEnabled: z.boolean().optional(),
})

export const filterCutoffMarks = [
  { value: getScaleValue(10), label: "10" },
  { value: getScaleValue(250), label: "250" },
  { value: getScaleValue(1_000), label: "1k" },
  { value: getScaleValue(2_500), label: "2.5k" },
  { value: getScaleValue(5_000), label: "5k" },
  { value: getScaleValue(9_000), label: "10k" },
  { value: getScaleValue(15_000), label: "15k" },
  { value: getScaleValue(22_000), label: "22k" },
]

export {
  getScaleValue, getValueFromScale, humanFormat,
  noteToSeconds, noteToFrequency, formatNoteDivision,
  detectBpm, audioBufferToWavBlob, downloadBlob,
}
