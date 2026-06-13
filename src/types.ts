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

export const DEFAULT_EFFECT_ORDER = [
  'speed', 'distortion', 'phaser', 'tremolo', 'reverb',
  'delay', 'chorus', 'bitcrusher', 'filter', 'autoPan',
] as const

export type EffectType = (typeof DEFAULT_EFFECT_ORDER)[number]

export type Settings = {
  effectOrder: EffectType[];
  speedEnabled: boolean;
  speed: number;
  filterEnabled: boolean;
  filterCutoff: number;
  file: File | undefined;
  duration: number | undefined;
  nextFile: File | undefined;
  loop: boolean;
  state: "ready" | "init";
  distortionEnabled: boolean;
  distortionDrive: number;
  reverbEnabled: boolean;
  reverbDecay: number;
  delayEnabled: boolean;
  delayTime: number;
  delayFeedback: number;
  delayWet: number;
  chorusEnabled: boolean;
  chorusRate: number;
  chorusDepth: number;
  bitcrusherEnabled: boolean;
  bitcrusherBits: number;
  tremoloEnabled: boolean;
  tremoloRate: number;
  tremoloDepth: number;
  phaserEnabled: boolean;
  phaserRate: number;
  phaserDepth: number;
  phaserFeedback: number;
  autoPanEnabled: boolean;
  autoPanRate: number;
  autoPanDepth: number;
  reverseEnabled: boolean;
  bpm: number;
  bpmDetected: number | null;
  delaySyncEnabled: boolean;
  delayNoteDivision: NoteDivision;
  phaserSyncEnabled: boolean;
  phaserNoteDivision: NoteDivision;
  tremoloSyncEnabled: boolean;
  tremoloNoteDivision: NoteDivision;
  chorusSyncEnabled: boolean;
  chorusNoteDivision: NoteDivision;
  reverbSyncEnabled: boolean;
  reverbNoteDivision: NoteDivision;
  autoPanSyncEnabled: boolean;
  autoPanNoteDivision: NoteDivision;
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

export const persistedSettingsSchema = z.object({
  effectOrder: z.array(z.string()).optional(),
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
  tremoloEnabled: z.boolean(),
  tremoloRate: z.number(),
  tremoloDepth: z.number(),
  phaserEnabled: z.boolean(),
  phaserRate: z.number(),
  phaserDepth: z.number(),
  phaserFeedback: z.number(),
  autoPanEnabled: z.boolean(),
  autoPanRate: z.number(),
  autoPanDepth: z.number(),
  reverseEnabled: z.boolean(),
  phaserSyncEnabled: z.boolean(),
  phaserNoteDivision: z.string(),
  tremoloSyncEnabled: z.boolean(),
  tremoloNoteDivision: z.string(),
  chorusSyncEnabled: z.boolean(),
  chorusNoteDivision: z.string(),
  reverbSyncEnabled: z.boolean(),
  reverbNoteDivision: z.string(),
  autoPanSyncEnabled: z.boolean(),
  autoPanNoteDivision: z.string(),
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
  detectBpm, audioBufferToWavBlob, downloadBlob
}
