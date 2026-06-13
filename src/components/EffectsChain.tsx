import { FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Card from '@mui/material/Card';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import EffectCard from './EffectCard';
import SnapControl from './SnapControl';
import {
  EFFECT_COLORS, EFFECT_TOOLTIPS, DEFAULT_EFFECT_ORDER,
  filterCutoffMarks, getScaleValue, getValueFromScale,
  humanFormat, noteToSeconds, noteToFrequency,
  Settings, EffectType,
} from '../types';

interface Props {
  settings: Settings
  onUpdate: (partial: Partial<Settings>) => void
}

const EFFECT_LABELS: Record<EffectType, string> = {
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

const EffectsChain: FunctionComponent<Props> = ({ settings, onUpdate }) => {
  const { effectOrder } = settings

  const [addAnchorEl, setAddAnchorEl] = useState<HTMLElement | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const availableTypes = DEFAULT_EFFECT_ORDER.filter(
    (t) => !effectOrder.includes(t)
  )

  const handleAddEffect = (type: EffectType) => {
    onUpdate({ effectOrder: [...effectOrder, type] })
    setAddAnchorEl(null)
  }

  const handleRemoveEffect = (index: number) => {
    const updated = effectOrder.filter((_, i) => i !== index)
    onUpdate({ effectOrder: updated })
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
    const updated = [...effectOrder]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(targetIndex, 0, moved)
    onUpdate({ effectOrder: updated })
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const activeChain = effectOrder.map((t) => EFFECT_LABELS[t]).join(' → ') || 'none active'


  const renderEffect = (type: EffectType, index: number) => {
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

    switch (type) {
      case 'speed':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.speedEnabled}
            sliderValue={settings.speed}
            sliderMin={0.1}
            sliderMax={2}
            sliderStep={0.01}
            marks={[
              { value: 0.5, label: ".5" },
              { value: 0.733, label: "day" },
              { value: 1, label: "1x" },
              { value: 1.364, label: "night" },
              { value: 2, label: "2x" },
            ]}
            displayValue={`${Math.round(settings.speed * 100)}%`}
            onToggle={(checked) => onUpdate({ speedEnabled: checked })}
            onChange={(value) => onUpdate({ speed: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'reverse':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.reverseEnabled}
            onToggle={(checked) => onUpdate({ reverseEnabled: checked })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'distortion':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.distortionEnabled}
            sliderValue={settings.distortionDrive}
            sliderMin={0}
            sliderMax={1}
            sliderStep={0.01}
            displayValue={settings.distortionDrive.toFixed(2)}
            onToggle={(checked) => onUpdate({ distortionEnabled: checked })}
            onChange={(value) => onUpdate({ distortionDrive: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'phaser':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.phaserEnabled}
            sliderValue={settings.phaserSyncEnabled ? 0.5 : settings.phaserRate}
            sliderMin={0.1}
            sliderMax={20}
            sliderStep={0.1}
            displayValue={settings.phaserSyncEnabled
              ? `${noteToFrequency(settings.phaserNoteDivision, settings.bpm).toFixed(2)}hz`
              : `${settings.phaserRate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate({ phaserEnabled: checked })}
            onChange={(value) => onUpdate({ phaserRate: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={settings.phaserDepth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!settings.phaserEnabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate({ phaserDepth: value as number })
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {settings.phaserDepth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={settings.phaserEnabled}
              syncEnabled={settings.phaserSyncEnabled}
              noteDivision={settings.phaserNoteDivision}
              color={color}
              showFrequency
              bpm={settings.bpm}
              onToggleSync={(v) => onUpdate({ phaserSyncEnabled: v })}
              onChangeDivision={(v) => onUpdate({ phaserNoteDivision: v })}
            />
          </EffectCard>
        )

      case 'tremolo':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.tremoloEnabled}
            sliderValue={settings.tremoloSyncEnabled ? 0.5 : settings.tremoloRate}
            sliderMin={0.1}
            sliderMax={20}
            sliderStep={0.1}
            displayValue={settings.tremoloSyncEnabled
              ? `${noteToFrequency(settings.tremoloNoteDivision, settings.bpm).toFixed(2)}hz`
              : `${settings.tremoloRate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate({ tremoloEnabled: checked })}
            onChange={(value) => onUpdate({ tremoloRate: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={settings.tremoloDepth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!settings.tremoloEnabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate({ tremoloDepth: value as number })
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {settings.tremoloDepth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={settings.tremoloEnabled}
              syncEnabled={settings.tremoloSyncEnabled}
              noteDivision={settings.tremoloNoteDivision}
              color={color}
              showFrequency
              bpm={settings.bpm}
              onToggleSync={(v) => onUpdate({ tremoloSyncEnabled: v })}
              onChangeDivision={(v) => onUpdate({ tremoloNoteDivision: v })}
            />
          </EffectCard>
        )

      case 'reverb':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.reverbEnabled}
            sliderValue={settings.reverbSyncEnabled ? 0.5 : settings.reverbDecay}
            sliderMin={0.1}
            sliderMax={10}
            sliderStep={0.1}
            displayValue={settings.reverbSyncEnabled
              ? `${noteToSeconds(settings.reverbNoteDivision, settings.bpm).toFixed(2)}s`
              : `${settings.reverbDecay.toFixed(1)}s`
            }
            onToggle={(checked) => onUpdate({ reverbEnabled: checked })}
            onChange={(value) => onUpdate({ reverbDecay: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <SnapControl
              enabled={settings.reverbEnabled}
              syncEnabled={settings.reverbSyncEnabled}
              noteDivision={settings.reverbNoteDivision}
              color={color}
              bpm={settings.bpm}
              onToggleSync={(v) => onUpdate({ reverbSyncEnabled: v })}
              onChangeDivision={(v) => onUpdate({ reverbNoteDivision: v })}
            />
          </EffectCard>
        )


      case 'delay':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.delayEnabled}
            sliderValue={settings.delaySyncEnabled ? 0.5 : settings.delayTime}
            sliderMin={0.01}
            sliderMax={1}
            sliderStep={0.01}
            displayValue={settings.delaySyncEnabled
              ? `${noteToSeconds(settings.delayNoteDivision, settings.bpm).toFixed(2)}s`
              : `${settings.delayTime.toFixed(2)}s`
            }
            onToggle={(checked) => onUpdate({ delayEnabled: checked })}
            onChange={(value) => onUpdate({ delayTime: value as number })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <SnapControl
              enabled={settings.delayEnabled}
              syncEnabled={settings.delaySyncEnabled}
              noteDivision={settings.delayNoteDivision}
              color={color}
              bpm={settings.bpm}
              onToggleSync={(v) => onUpdate({ delaySyncEnabled: v })}
              onChangeDivision={(v) => onUpdate({ delayNoteDivision: v })}
            />
          </EffectCard>
        )

      case 'chorus':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.chorusEnabled}
            sliderValue={settings.chorusSyncEnabled ? 0.5 : settings.chorusRate}
            sliderMin={0.1}
            sliderMax={10}
            sliderStep={0.1}
            displayValue={settings.chorusSyncEnabled
              ? `${noteToFrequency(settings.chorusNoteDivision, settings.bpm).toFixed(2)}hz`
              : `${settings.chorusRate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate({ chorusEnabled: checked })}
            onChange={(value) => onUpdate({ chorusRate: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={settings.chorusDepth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!settings.chorusEnabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate({ chorusDepth: value as number })
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {settings.chorusDepth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={settings.chorusEnabled}
              syncEnabled={settings.chorusSyncEnabled}
              noteDivision={settings.chorusNoteDivision}
              color={color}
              showFrequency
              bpm={settings.bpm}
              onToggleSync={(v) => onUpdate({ chorusSyncEnabled: v })}
              onChangeDivision={(v) => onUpdate({ chorusNoteDivision: v })}
            />
          </EffectCard>
        )


      case 'bitcrusher':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.bitcrusherEnabled}
            sliderValue={settings.bitcrusherBits}
            sliderMin={1}
            sliderMax={16}
            sliderStep={1}
            marks={[
              { value: 1, label: "1" },
              { value: 8, label: "8" },
              { value: 16, label: "16" },
            ]}
            displayValue={`${settings.bitcrusherBits}bit`}
            onToggle={(checked) => onUpdate({ bitcrusherEnabled: checked })}
            onChange={(value) => onUpdate({ bitcrusherBits: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'filter':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.filterEnabled}
            sliderValue={getScaleValue(settings.filterCutoff)}
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
            displayValue={`${humanFormat(settings.filterCutoff)}hz`}
            onToggle={(checked) => onUpdate({ filterEnabled: checked })}
            onChange={(value) => onUpdate({ filterCutoff: getValueFromScale(value) })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          />
        )

      case 'autoPan':
        return (
          <EffectCard
            key={`effect-${index}-${type}`}
            color={color}
            label={label}
            tooltip={tooltip}
            enabled={settings.autoPanEnabled}
            sliderValue={settings.autoPanSyncEnabled ? 0.5 : settings.autoPanRate}
            sliderMin={0.1}
            sliderMax={20}
            sliderStep={0.1}
            displayValue={settings.autoPanSyncEnabled
              ? `${noteToFrequency(settings.autoPanNoteDivision, settings.bpm).toFixed(2)}hz`
              : `${settings.autoPanRate.toFixed(1)}hz`
            }
            onToggle={(checked) => onUpdate({ autoPanEnabled: checked })}
            onChange={(value) => onUpdate({ autoPanRate: value })}
            onRemove={() => handleRemoveEffect(index)}
            dragHandlers={dragHandlers}
            isDragOver={isDragOver}
          >
            <Slider
              value={settings.autoPanDepth}
              max={1}
              min={0}
              step={0.01}
              sx={{
                width: 60, py: 0,
                '& .MuiSlider-track': { border: 'none', bgcolor: color },
                '& .MuiSlider-thumb': { bgcolor: color, width: 10, height: 10 },
              }}
              disabled={!settings.autoPanEnabled}
              onChange={(_, value) => {
                if (Array.isArray(value)) return
                onUpdate({ autoPanDepth: value as number })
              }}
            />
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', mt: -0.25 }}>
              {settings.autoPanDepth.toFixed(2)}
            </Typography>
            <SnapControl
              enabled={settings.autoPanEnabled}
              syncEnabled={settings.autoPanSyncEnabled}
              noteDivision={settings.autoPanNoteDivision}
              color={color}
              showFrequency
              bpm={settings.bpm}
              onToggleSync={(v) => onUpdate({ autoPanSyncEnabled: v })}
              onChangeDivision={(v) => onUpdate({ autoPanNoteDivision: v })}
            />
          </EffectCard>
        )
    }
  }


  return (
    <Box>
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
        {effectOrder.map((type, index) => renderEffect(type, index))}

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
        {availableTypes.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: 12, opacity: 0.5 }}>
            All effects added
          </MenuItem>
        ) : (
          availableTypes.map((type) => (
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
          ))
        )}
      </Menu>
    </Box>
  )
}

export default EffectsChain
