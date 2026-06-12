const SCALE_POWER = 2.5

export const humanFormat = (value: number) => {
  if (value > 9999) return `${Math.round(value / 1000)}K`
  if (value > 999) return `${Math.round(value / 100) / 10}K`
  return Math.round(value)
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
