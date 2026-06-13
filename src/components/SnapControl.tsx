import { FunctionComponent } from 'preact';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { NOTE_DIVISIONS, NoteDivision } from '../types';
import { noteToSeconds, noteToFrequency, formatNoteDivision } from '../lib';

export interface SnapControlProps {
  enabled: boolean
  syncEnabled: boolean
  noteDivision: NoteDivision
  color: string
  /** When true, displays frequency (Hz) instead of seconds – used for LFO effects */
  showFrequency?: boolean
  bpm: number
  onToggleSync: (v: boolean) => void
  onChangeDivision: (v: NoteDivision) => void
}

const SnapControl: FunctionComponent<SnapControlProps> = ({
  enabled,
  syncEnabled,
  noteDivision,
  color,
  showFrequency,
  bpm,
  onToggleSync,
  onChangeDivision,
}) => {
  const computed = showFrequency
    ? noteToFrequency(noteDivision, bpm)
    : noteToSeconds(noteDivision, bpm)

  const display = showFrequency
    ? `${computed.toFixed(2)}hz`
    : `${computed.toFixed(2)}s`

  return (
    <Box display="flex" gap={0.3} alignItems="center" flexWrap="wrap" justifyContent="center">
      <Tooltip title={`Snap to note division${showFrequency ? ' (rate)' : ''}`}>
        <Button
          size="small"
          variant={syncEnabled ? 'contained' : 'outlined'}
          onClick={() => onToggleSync(!syncEnabled)}
          disabled={!enabled}
          sx={{
            fontSize: 8, py: 0.1, px: 0.5, minWidth: 28, lineHeight: 1.1,
            color: syncEnabled ? undefined : color,
            borderColor: color,
          }}
        >
          Snap
        </Button>
      </Tooltip>
      {syncEnabled && (
        <select
          value={noteDivision}
          onChange={(e) => onChangeDivision((e.target as HTMLSelectElement).value as NoteDivision)}
          style={{
            fontSize: 9, padding: '1px 2px', borderRadius: 4,
            border: `1px solid ${color}44`,
            background: 'transparent', color: 'inherit', width: 46,
          }}
          disabled={!enabled}
        >
          {NOTE_DIVISIONS.map((n) => (
            <option key={n} value={n}>{formatNoteDivision(n)}</option>
          ))}
        </select>
      )}
      {syncEnabled && (
        <Typography variant="caption" sx={{ fontSize: 8, color: 'text.disabled', width: '100%', textAlign: 'center' }}>
          {display}
        </Typography>
      )}
    </Box>
  )
}

export default SnapControl
