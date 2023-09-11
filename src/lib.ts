const SCALE_POWER = 2.5

export const humanFormat = (value: number) => {
  if (value > 9999) return `${Math.round(value / 1000)}K`
  if (value > 999) return `${Math.round(value / 100) / 10}K`
  return Math.round(value)
}


export const getScaleValue = (value: number) => Math.pow(Math.abs(value), 1 / SCALE_POWER)
export const getValueFromScale = (value: number) => Math.pow(value, SCALE_POWER)
