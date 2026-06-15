import { FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import EffectCard from './EffectCard';
import SnapControl from './SnapControl';
import {
  EFFECT_COLORS, EFFECT_TOOLTIPS, DEFAULT_EFFECT_ORDER, CHAINABLE_EFFECTS,
  filterCutoffMarks, getScaleValue, getValueFromScale,
  humanFormat, noteToSeconds, noteToFrequency, createDefaultInstance,
  Settings, EffectType, EffectInstance, AllEffectType,
} from '../types';

interface Props {
  settings: Settings
  onUpdate: (partial: Partial<Settings>) => void
}

const EFFECT_LABELS: Record<AllEffectType, string> = {
  speed: 'Speed',
  reverse: 'Reverse',
  distortion: 'Distortion',
  phaser: 'Phaser',
  tremolo: 'Tremolo',
  reverb: 'Reverb',
  delay: 'Delay',
  chorus: 'Chorus',
  bitcrusher: 'Bit Crush',
  filter: 'Filter',
  autoPan: 'Auto Pan',
}

/** Helper: return a partial settings update that merges new params into an instance by ID. */
function patchInstance(instances: EffectInstance[], id: string, paramUpdates: Record<string, unknown>): { effectInstances: EffectInstance[] } {
  return {
    effectInstances: instances.map((inst) =>
      inst.id === id ? { ...inst, params: { ...(inst.params as any), ...paramUpdates } as any } : inst
    ),
  }
}

const EffectsChain: FunctionComponent<Props> = ({ settings, onUpdate }) => {
  const { effectInstances } = settings
  const { bpm } = settings

  const [addAnchorEl, setAddAnchorEl] = useState<HTMLElement | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Only chainable effects can be added to the grid
  const availableTypes = [...CHAINABLE_EFFECTS]

  const handleAddEffect = (type: EffectType) => {
    const newInst = createDefaultInstance(type)
    onUpdate({ effectInstances: [...effectInstances, newInst] })
    setAddAnchorEl(null)
  }

  const handleRemoveEffect = (index: number) => {
    const updated = effectInstances.filter((_, i) => i !== index)
    onUpdate({ effectInstances: updated })
  }

  const handleDragStart = (index: number) => (e: preact.JSX.TargetedDragEvent<HTMLDivElement>) => {
    setDragIndex(index)
    const dt = e.dataTransfer!
    dt.effectAllowed = 'move'
    dt.setData('text/plain', String(index))
    setTimeout(() => {
      ;(e.target as HTMLElement).style.opacity = '0.4'
    }, 0)
  }

  const handleDragOver = (index: number) => (e: preact.JSX.TargetedDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => (e: preact.JSX.TargetedDragEvent<HTMLDivElement>) => {
    ;(e.target as HTMLElement).style.opacity = ''
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (targetIndex: number) => (e: preact.JSX.TargetedDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    ;(e.target as HTMLElement).style.opacity = ''
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const updated = [...effectInstances]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(targetIndex, 0, moved)
    onUpdate({ effectInstances: updated })
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const activeChain = effectInstances.map((inst) => EFFECT_LABELS[inst.type]).join(' → ') || 'none active'

  const renderEffect = (inst: EffectInstance, index: number) => {
    const { id, type, params } = inst
    const color = EFFECT_COLORS[type]
    const tooltip = EFFECT_TOOLTIPS[type]
    const label = EFFECT_LABELS[type]

    const dragHandlers = {
      onDragStart: handleDragStart(index),
      onDragOver: handleDragOver(index),
      onDragEnd: handleDragEnd(),
      onDrop: handleDrop(index),
    }

    const isDragOver = dragOverIndex === index && dragIndex !== index
    const p = params as any

    switch (type) {
      case 'distortion':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.drive}
            sliderMin={0}
            sliderMax={1}
            sliderStep={0.01}
            displayValue={p.drive.toFixed(2)}
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { drive: value }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'phaser':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.syncEnabled ? 0.5 : p.rate}
            sliderMin={0.1}
            sliderMax={20}
            sliderStep={0.1}
            displayValue={p.syncEnabled
              ? `${noteToFrequency(p.noteDivision, bpm).toFixed(2)}hz`
              : `${p.rate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { rate: value }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={p.depth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!p.enabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate(patchInstance(effectInstances, id, { depth: value as number }))
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {p.depth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={p.enabled}
              syncEnabled={p.syncEnabled}
              noteDivision={p.noteDivision}
              color={color}
              showFrequency
              bpm={bpm}
              onToggleSync={(v) => onUpdate(patchInstance(effectInstances, id, { syncEnabled: v }))}
              onChangeDivision={(v) => onUpdate(patchInstance(effectInstances, id, { noteDivision: v }))}
            />
          </EffectCard>
        )

      case 'tremolo':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.syncEnabled ? 0.5 : p.rate}
            sliderMin={0.1}
            sliderMax={20}
            sliderStep={0.1}
            displayValue={p.syncEnabled
              ? `${noteToFrequency(p.noteDivision, bpm).toFixed(2)}hz`
              : `${p.rate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { rate: value }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={p.depth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!p.enabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate(patchInstance(effectInstances, id, { depth: value as number }))
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {p.depth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={p.enabled}
              syncEnabled={p.syncEnabled}
              noteDivision={p.noteDivision}
              color={color}
              showFrequency
              bpm={bpm}
              onToggleSync={(v) => onUpdate(patchInstance(effectInstances, id, { syncEnabled: v }))}
              onChangeDivision={(v) => onUpdate(patchInstance(effectInstances, id, { noteDivision: v }))}
            />
          </EffectCard>
        )

      case 'reverb':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.syncEnabled ? 0.5 : p.decay}
            sliderMin={0.1}
            sliderMax={10}
            sliderStep={0.1}
            displayValue={p.syncEnabled
              ? `${noteToSeconds(p.noteDivision, bpm).toFixed(2)}s`
              : `${p.decay.toFixed(1)}s`
            }
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { decay: value }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <SnapControl
              enabled={p.enabled}
              syncEnabled={p.syncEnabled}
              noteDivision={p.noteDivision}
              color={color}
              bpm={bpm}
              onToggleSync={(v) => onUpdate(patchInstance(effectInstances, id, { syncEnabled: v }))}
              onChangeDivision={(v) => onUpdate(patchInstance(effectInstances, id, { noteDivision: v }))}
            />
          </EffectCard>
        )


      case 'delay':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.syncEnabled ? 0.5 : p.time}
            sliderMin={0.01}
            sliderMax={1}
            sliderStep={0.01}
            displayValue={p.syncEnabled
              ? `${noteToSeconds(p.noteDivision, bpm).toFixed(2)}s`
              : `${p.time.toFixed(2)}s`
            }
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { time: value as number }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <SnapControl
              enabled={p.enabled}
              syncEnabled={p.syncEnabled}
              noteDivision={p.noteDivision}
              color={color}
              bpm={bpm}
              onToggleSync={(v) => onUpdate(patchInstance(effectInstances, id, { syncEnabled: v }))}
              onChangeDivision={(v) => onUpdate(patchInstance(effectInstances, id, { noteDivision: v }))}
            />
          </EffectCard>
        )

      case 'chorus':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.syncEnabled ? 0.5 : p.rate}
            sliderMin={0.1}
            sliderMax={10}
            sliderStep={0.1}
            displayValue={p.syncEnabled
              ? `${noteToFrequency(p.noteDivision, bpm).toFixed(2)}hz`
              : `${p.rate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { rate: value }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={p.depth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!p.enabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate(patchInstance(effectInstances, id, { depth: value as number }))
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {p.depth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={p.enabled}
              syncEnabled={p.syncEnabled}
              noteDivision={p.noteDivision}
              color={color}
              showFrequency
              bpm={bpm}
              onToggleSync={(v) => onUpdate(patchInstance(effectInstances, id, { syncEnabled: v }))}
              onChangeDivision={(v) => onUpdate(patchInstance(effectInstances, id, { noteDivision: v }))}
            />
          </EffectCard>
        )


      case 'bitcrusher':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.bits}
            sliderMin={1}
            sliderMax={16}
            sliderStep={1}
            marks={[
              { value: 1, label: "1" },
              { value: 8, label: "8" },
              { value: 16, label: "16" },
            ]}
            displayValue={`${p.bits}bit`}
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { bits: value }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'filter':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={getScaleValue(p.cutoff)}
            sliderMin={1}
            sliderMax={filterCutoffMarks[filterCutoffMarks.length - 1].value}
            sliderStep={0.1}
            marks={[
              { value: getScaleValue(10), label: "10" },
              { value: getScaleValue(100), label: "100" },
              { value: getScaleValue(1_000), label: "1k" },
              { value: getScaleValue(10_000), label: "10k" },
              { value: getScaleValue(22_000), label: "22k" },
            ]}
            displayValue={`${humanFormat(p.cutoff)}hz`}
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { cutoff: getValueFromScale(value) }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'autoPan':
        return (
          <EffectCard
            key={id}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={p.enabled}
            sliderValue={p.syncEnabled ? 0.5 : p.rate}
            sliderMin={0.1}
            sliderMax={20}
            sliderStep={0.1}
            displayValue={p.syncEnabled
              ? `${noteToFrequency(p.noteDivision, bpm).toFixed(2)}hz`
              : `${p.rate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate(patchInstance(effectInstances, id, { enabled: checked }))}
            onChange={(value) => onUpdate(patchInstance(effectInstances, id, { rate: value }))}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={p.depth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!p.enabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate(patchInstance(effectInstances, id, { depth: value as number }))
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {p.depth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={p.enabled}
              syncEnabled={p.syncEnabled}
              noteDivision={p.noteDivision}
              color={color}
              showFrequency
              bpm={bpm}
              onToggleSync={(v) => onUpdate(patchInstance(effectInstances, id, { syncEnabled: v }))}
              onChangeDivision={(v) => onUpdate(patchInstance(effectInstances, id, { noteDivision: v }))}
            />
          </EffectCard>
        )
    }
  }


  const speedColor = '#4fc3f7'
  const reverseColor = '#f48fb1'

  return (
    <Box>
      {/* Speed control — locked one-off at the top of the effects panel */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          mb: 1, px: 1.5, py: 1,
          borderRadius: 2, bgcolor: `${speedColor}0a`,
          border: '1px solid', borderColor: settings.speedEnabled ? `${speedColor}55` : 'divider',
          transition: 'all 0.2s',
        }}
      >
        <Tooltip title="Playback speed (tempo + pitch). Locked at the start of the chain.">
          <Checkbox
            checked={settings.speedEnabled}
            onChange={(e) => onUpdate({ speedEnabled: e.currentTarget.checked })}
            sx={{
              py: 0, px: 0,
              '& .MuiSvgIcon-root': { fontSize: 18 },
              color: settings.speedEnabled ? speedColor : undefined,
              '&.Mui-checked': { color: speedColor },
            }}
            size="small"
          />
        </Tooltip>
        <Typography
          variant="caption"
          sx={{
            fontSize: 10, lineHeight: 1.1, fontWeight: 700,
            letterSpacing: 0.3, textTransform: 'uppercase',
            color: settings.speedEnabled ? speedColor : 'text.disabled',
            whiteSpace: 'nowrap',
          }}
        >
          Speed
        </Typography>
        <Slider
          value={settings.speed}
          min={0.1}
          max={2}
          step={0.01}
          marks={[
            { value: 0.5, label: "0.5x" },
            { value: 0.733, label: "day" },
            { value: 1, label: "1x" },
            { value: 1.364, label: "night" },
            { value: 2, label: "2x" },
          ]}
          sx={{
            flex: 1, mx: { xs: 0.5, sm: 1 }, py: 0,
            '& .MuiSlider-track': {
              border: 'none',
              bgcolor: settings.speedEnabled ? speedColor : undefined,
              transition: 'all 0.2s',
            },
            '& .MuiSlider-thumb': {
              bgcolor: settings.speedEnabled ? speedColor : undefined,
              width: 14,
              height: 14,
              '&:hover, &.Mui-active': {
                boxShadow: `0 0 0 8px ${speedColor}22`,
              },
            },
            '& .MuiSlider-rail': {
              opacity: settings.speedEnabled ? 0.25 : 0.1,
            },
            '& .MuiSlider-mark': {
              display: settings.speedEnabled ? 'block' : 'none',
            },
            '& .MuiSlider-markLabel': {
              fontSize: 8,
              color: settings.speedEnabled ? speedColor : 'text.disabled',
            },
          }}
          disabled={!settings.speedEnabled}
          onChange={(_, value) => {
            if (Array.isArray(value)) return
            onUpdate({ speed: value as number })
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontSize: 11,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: settings.speedEnabled ? 'text.primary' : 'text.disabled',
            minWidth: 48,
            textAlign: 'right',
            letterSpacing: 0.2,
            transition: 'color 0.2s',
          }}
        >
          {Math.round(settings.speed * 100)}%
        </Typography>
      </Box>

      {/* Reverse toggle — locked at the start of the effects panel */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          mb: 1.5, px: 1, py: 0.5,
          borderRadius: 2, bgcolor: `${reverseColor}0a`,
          border: '1px solid', borderColor: settings.reverseEnabled ? `${reverseColor}55` : 'divider',
        }}
      >
        <Tooltip title="Reverses the entire audio file. Locked at the start of the chain so all effects process reversed audio.">
          <Checkbox
            checked={settings.reverseEnabled}
            onChange={(e) => onUpdate({ reverseEnabled: e.currentTarget.checked })}
            sx={{
              py: 0, px: 0,
              '& .MuiSvgIcon-root': { fontSize: 18 },
              color: settings.reverseEnabled ? reverseColor : undefined,
              '&.Mui-checked': { color: reverseColor },
            }}
            size="small"
          />
        </Tooltip>
        <Typography
          variant="caption"
          sx={{
            fontSize: 10, lineHeight: 1.1, fontWeight: 700,
            letterSpacing: 0.3, textTransform: 'uppercase',
            color: settings.reverseEnabled ? reverseColor : 'text.disabled',
          }}
        >
          Reverse
        </Typography>
        {settings.reverseEnabled && (
          <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', ml: 'auto' }}>
            File plays backwards
          </Typography>
        )}
      </Box>

      {/* Section header */}
      <Box display="flex" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 800,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            color: 'text.secondary',
          }}
        >
          Effects
        </Typography>
        <Box sx={{ flex: 1, ml: 1.5, height: 1, bgcolor: 'divider' }} />
        <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', ml: 1, fontFamily: 'monospace' }}>
          {activeChain}
        </Typography>
      </Box>

      {/* Cards grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 1,
        alignItems: 'stretch',
      }}>
        {effectInstances.map((inst, index) => renderEffect(inst, index))}

        {/* Add effect card */}
        <Card
          elevation={0}
          sx={{
            minWidth: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: { xs: 1, sm: 1.25 },
            px: { xs: 0.5, sm: 0.75 },
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2.5,
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
          onClick={(e: any) => setAddAnchorEl(e.currentTarget)}

        >
          <AddIcon sx={{ fontSize: 20, color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 600, color: 'text.disabled' }}>
            Add Effect
          </Typography>
        </Card>
      </Box>

      {/* Add effect menu */}
      <Menu
        anchorEl={addAnchorEl}
        open={Boolean(addAnchorEl)}
        onClose={() => setAddAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {availableTypes.map((type) => (
          <MenuItem
            key={type}
            onClick={() => handleAddEffect(type)}
            sx={{ fontSize: 13, gap: 1 }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: EFFECT_COLORS[type],
                flexShrink: 0,
              }}
            />
            {EFFECT_LABELS[type]}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

export default EffectsChain
