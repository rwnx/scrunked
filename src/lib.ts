const SCALE_POWER = 2.5

export const humanFormat = (value: number) => {
  if (value > 9999) return `${Math.round(value / 1000)}K`
  if (value > 999) return `${Math.round(value / 100) / 10}K`
  return Math.round(value)
}

/** Note divisions supported for BPM sync */
export const NOTE_DIVISIONS = ['1/8', '1/4', '1/2', '1/1'] as const
export type NoteDivision = (typeof NOTE_DIVISIONS)[number]

/** Convert a note division to seconds at the given BPM. */
export function noteToSeconds(note: NoteDivision, bpm: number): number {
  const quarterNote = 60 / bpm
  switch (note) {
    case '1/8': return quarterNote / 2
    case '1/4': return quarterNote
    case '1/2': return quarterNote * 2
    case '1/1': return quarterNote * 4
  }
}

/**
 * Detect tempo (BPM) from an AudioBuffer using autocorrelation.
 * Returns null if detection fails or audio is too short.
 */
export function detectBpm(audioBuffer: AudioBuffer): number | null {
  try {
    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate

    // Downsample to ~200 Hz for efficient processing
    const targetRate = 200
    const decimation = Math.max(1, Math.round(sampleRate / targetRate))
    const actualRate = sampleRate / decimation

    const downsampled: number[] = []
    for (let i = 0; i < channelData.length; i += decimation) {
      downsampled.push(channelData[i])
    }

    const len = downsampled.length
    if (len < actualRate * 2) return null // need at least 2 seconds

    // Autocorrelation over the BPM range 50–200
    const minLag = Math.round(actualRate / 200) // fastest
    const maxLag = Math.round(actualRate / 50)  // slowest

    let bestLag = 0
    let bestCorr = 0

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0
      const n = len - lag
      for (let i = 0; i < n; i++) {
        corr += downsampled[i] * downsampled[i + lag]
      }
      corr /= n

      if (corr > bestCorr) {
        bestCorr = corr
        bestLag = lag
      }
    }

    if (bestLag === 0) return null
    const bpm = Math.round((actualRate / bestLag) * 60)
    return Math.max(50, Math.min(200, bpm))
  } catch {
    return null
  }
}


export const getScaleValue = (value: number) => Math.pow(Math.abs(value), 1 / SCALE_POWER)
export const getValueFromScale = (value: number) => Math.pow(value, SCALE_POWER)

/**
 * Convert an AudioBuffer (float PCM, multi-channel) to a 16-bit PCM WAV Blob.
 */
export const audioBufferToWavBlob = (audioBuffer: AudioBuffer): Blob => {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const numSamples = audioBuffer.length
  const dataLength = numSamples * blockAlign

  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, "WAVE")

  // fmt chunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)         // chunk size
  view.setUint16(20, 1, true)          // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data chunk
  writeString(view, 36, "data")
  view.setUint32(40, dataLength, true)

  // Write interleaved PCM samples
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch)
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: "audio/wav" })
}

const writeString = (view: DataView, offset: number, str: string) => {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Trigger a browser file download from a Blob.
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
