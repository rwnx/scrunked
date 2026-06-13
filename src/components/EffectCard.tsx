import { FunctionComponent } from 'preact';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

export type CardDef = {
  color: string
  label: string
  tooltip: string
  icon?: string
  enabled: boolean
  sliderValue: number
  sliderMin: number
  sliderMax: number
  sliderStep: number
  marks?: { value: number; label: string }[]
  displayValue: string
  onToggle: (checked: boolean) => void
  onChange: (value: number) => void
  children?: preact.ComponentChildren
}

const EffectCard: FunctionComponent<CardDef> = ({
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
  children,
}) => (
  <Card
    elevation={0}
    sx={{
      minWidth: 0,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: { xs: 1, sm: 1.25 },
      px: { xs: 0.5, sm: 0.75 },
      opacity: enabled ? 1 : 0.55,
      border: '1px solid',
      borderColor: enabled ? `${color}55` : 'divider',
      borderRadius: 2.5,
      position: 'relative',
      bgcolor: enabled ? `${color}0a` : 'background.paper',
      backdropFilter: enabled ? 'blur(8px)' : 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        borderColor: enabled ? `${color}99` : 'divider',
        bgcolor: enabled ? `${color}15` : 'action.hover',
        transform: enabled ? 'translateY(-1px)' : 'none',
      },
      '& .MuiSlider-thumb': {
        display: enabled ? 'block' : 'none',
      },
    }}
  >
    <Box display="flex" alignItems="center" flexDirection="column" mb={0.5}>
      <Tooltip title={tooltip} placement="top" arrow>
        <Checkbox
          checked={enabled}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          sx={{
            py: 0,
            px: 0,
            '& .MuiSvgIcon-root': { fontSize: 18 },
            color: enabled ? color : undefined,
            '&.Mui-checked': { color },
          }}
          size="small"
        />
      </Tooltip>
      <Typography
        variant="caption"
        sx={{
          fontSize: 10,
          lineHeight: 1.1,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: enabled ? color : 'text.disabled',
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
        height: { xs: 90, sm: 110 },
        mb: 0.25,
        '& .MuiSlider-track': {
          border: 'none',
          bgcolor: enabled ? color : undefined,
          transition: 'all 0.2s ease',
        },
        '& .MuiSlider-thumb': {
          bgcolor: enabled ? color : undefined,
          width: 14,
          height: 14,
          '&:hover, &.Mui-active': {
            boxShadow: `0 0 0 8px ${color}22`,
          },
        },
        '& .MuiSlider-rail': {
          opacity: enabled ? 0.25 : 0.1,
        },
        '& .MuiSlider-mark': {
          display: enabled ? 'block' : 'none',
        },
      }}
      disabled={!enabled}
      onChange={(_, value) => {
        if (Array.isArray(value)) throw new Error('single value required')
        onChange(value as number)
      }}
    />
    <Typography
      variant="caption"
      sx={{
        fontSize: 10,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color: enabled ? 'text.primary' : 'text.disabled',
        transition: 'color 0.2s',
      }}
    >
      {displayValue}
    </Typography>
    {children && (
      <Box sx={{ mt: 0.5, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </Box>
    )}
  </Card>
)

export default EffectCard
