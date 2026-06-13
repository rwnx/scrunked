import { FunctionComponent } from 'preact';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EffectCard from './EffectCard';
import {
  EFFECT_COLORS, EFFECT_TOOLTIPS, NOTE_DIVISIONS,
  filterCutoffMarks, getScaleValue, getValueFromScale,
  humanFormat, noteToSeconds, Settings, NoteDivision
} from '../types';

interface Props {
  settings: Settings
  onUpdate: (partial: Partial<Settings>) => void
}

const PipeConnector: FunctionComponent<{ color?: string; active?: boolean }> = ({ color, active }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'center',
      color: active && color ? color : 'text.disabled',
      opacity: active ? 0.85 : 0.2,
      flexShrink: 0,
      transition: 'all 0.3s ease',
      mx: 0.15,
    }}
  >
    <ArrowForwardIcon sx={{ fontSize: 20 }} />
  </Box>
)

const EffectsChain: FunctionComponent<Props> = ({ settings, onUpdate }) => {
  const isDelaySync = settings.delaySyncEnabled

  const activeChain = [
    'Speed',
    ...(settings.distortionEnabled ? ['Dist'] : []),
    ...(settings.phaserEnabled ? ['Phase'] : []),
    ...(settings.tremoloEnabled ? ['Trem'] : []),
    ...(settings.reverbEnabled ? ['Verb'] : []),
    ...(settings.delayEnabled ? ['Delay'] : []),
    ...(settings.chorusEnabled ? ['Chorus'] : []),
    ...(settings.bitcrusherEnabled ? ['Bit'] : []),
    ...(settings.filterEnabled ? ['LPF'] : []),
    ...(settings.autoPanEnabled ? ['Pan'] : []),
  ].join(' → ') || 'none active'

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

      {/* Cards row */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Speed */}
        <EffectCard
          color={EFFECT_COLORS.speed}
          label="Speed"
          tooltip={EFFECT_TOOLTIPS.speed}
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
        />
        <PipeConnector color={EFFECT_COLORS.speed} active={settings.speedEnabled} />

        {/* Distortion */}
        <EffectCard
          color={EFFECT_COLORS.distortion}
          label="Distortion"
          tooltip={EFFECT_TOOLTIPS.distortion}
          enabled={settings.distortionEnabled}
          sliderValue={settings.distortionDrive}
          sliderMin={0}
          sliderMax={1}
          sliderStep={0.01}
          displayValue={settings.distortionDrive.toFixed(2)}
          onToggle={(checked) => onUpdate({ distortionEnabled: checked })}
          onChange={(value) => onUpdate({ distortionDrive: value })}
        />
        <PipeConnector color={EFFECT_COLORS.distortion} active={settings.distortionEnabled} />

        {/* Phaser */}
        <EffectCard
          color={EFFECT_COLORS.phaser}
          label="Phaser"
          tooltip={EFFECT_TOOLTIPS.phaser}
          enabled={settings.phaserEnabled}
          sliderValue={settings.phaserRate}
          sliderMin={0.1}
          sliderMax={20}
          sliderStep={0.1}
          displayValue={`${settings.phaserRate.toFixed(1)}hz`}
          onToggle={(checked) => onUpdate({ phaserEnabled: checked })}
          onChange={(value) => onUpdate({ phaserRate: value })}
        >
          <Slider
            value={settings.phaserDepth}
            max={1}
            min={0}
            step={0.01}
            sx={{
              width: 60, py: 0,
              '& .MuiSlider-track': { border: 'none', bgcolor: EFFECT_COLORS.phaser },
              '& .MuiSlider-thumb': { bgcolor: EFFECT_COLORS.phaser, width: 10, height: 10 },
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
        </EffectCard>
        <PipeConnector color={EFFECT_COLORS.phaser} active={settings.phaserEnabled} />

        {/* Tremolo */}
        <EffectCard
          color={EFFECT_COLORS.tremolo}
          label="Tremolo"
          tooltip={EFFECT_TOOLTIPS.tremolo}
          enabled={settings.tremoloEnabled}
          sliderValue={settings.tremoloRate}
          sliderMin={0.1}
          sliderMax={20}
          sliderStep={0.1}
          displayValue={`${settings.tremoloRate.toFixed(1)}hz`}
          onToggle={(checked) => onUpdate({ tremoloEnabled: checked })}
          onChange={(value) => onUpdate({ tremoloRate: value })}
        >
          <Slider
            value={settings.tremoloDepth}
            max={1}
            min={0}
            step={0.01}
            sx={{
              width: 60, py: 0,
              '& .MuiSlider-track': { border: 'none', bgcolor: EFFECT_COLORS.tremolo },
              '& .MuiSlider-thumb': { bgcolor: EFFECT_COLORS.tremolo, width: 10, height: 10 },
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
        </EffectCard>
        <PipeConnector color={EFFECT_COLORS.tremolo} active={settings.tremoloEnabled} />

        {/* Reverb */}
        <EffectCard
          color={EFFECT_COLORS.reverb}
          label="Reverb"
          tooltip={EFFECT_TOOLTIPS.reverb}
          enabled={settings.reverbEnabled}
          sliderValue={settings.reverbDecay}
          sliderMin={0.1}
          sliderMax={10}
          sliderStep={0.1}
          displayValue={`${settings.reverbDecay.toFixed(1)}s`}
          onToggle={(checked) => onUpdate({ reverbEnabled: checked })}
          onChange={(value) => onUpdate({ reverbDecay: value })}
        />
        <PipeConnector color={EFFECT_COLORS.reverb} active={settings.reverbEnabled} />
        <PipeConnector color={EFFECT_COLORS.reverb} active={settings.reverbEnabled} />

        {/* Delay */}
        <EffectCard
          color={EFFECT_COLORS.delay}
          label="Delay"
          tooltip={EFFECT_TOOLTIPS.delay}
          enabled={settings.delayEnabled}
          sliderValue={isDelaySync ? 0.5 : settings.delayTime}
          sliderMin={0.01}
          sliderMax={1}
          sliderStep={0.01}
          displayValue={isDelaySync
            ? `${noteToSeconds(settings.delayNoteDivision, settings.bpm).toFixed(2)}s`
            : `${settings.delayTime.toFixed(2)}s`
          }
          onToggle={(checked) => onUpdate({ delayEnabled: checked })}
          onChange={(value) => onUpdate({ delayTime: value as number })}
        >
          <Box display="flex" gap={0.3} alignItems="center">
            <Tooltip title="Sync delay to BPM">
              <Button
                size="small"
                variant={isDelaySync ? 'contained' : 'outlined'}
                onClick={() => onUpdate({ delaySyncEnabled: !isDelaySync })}
                sx={{
                  fontSize: 8, py: 0.1, px: 0.5, minWidth: 28, lineHeight: 1.1,
                  color: isDelaySync ? undefined : EFFECT_COLORS.delay,
                  borderColor: EFFECT_COLORS.delay,
                }}
              >
                Sync
              </Button>
            </Tooltip>
            {isDelaySync && (
              <select
                value={settings.delayNoteDivision}
                onChange={(e) => onUpdate({ delayNoteDivision: (e.target as HTMLSelectElement).value as NoteDivision })}
                style={{
                  fontSize: 9, padding: '1px 2px', borderRadius: 4,
                  border: `1px solid ${EFFECT_COLORS.delay}44`,
                  background: 'transparent', color: 'inherit', width: 36,
                }}
                disabled={!settings.delayEnabled}
              >
                {NOTE_DIVISIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </Box>
          {isDelaySync && (
            <Typography variant="caption" sx={{ fontSize: 8, color: 'text.disabled' }}>
              {noteToSeconds(settings.delayNoteDivision, settings.bpm).toFixed(2)}s
            </Typography>
          )}
        </EffectCard>
        <PipeConnector color={EFFECT_COLORS.delay} active={settings.delayEnabled} />
        <PipeConnector color={EFFECT_COLORS.delay} active={settings.delayEnabled} />

        {/* Chorus */}
        <EffectCard
          color={EFFECT_COLORS.chorus}
          label="Chorus"
          tooltip={EFFECT_TOOLTIPS.chorus}
          enabled={settings.chorusEnabled}
          sliderValue={settings.chorusRate}
          sliderMin={0.1}
          sliderMax={10}
          sliderStep={0.1}
          displayValue={`${settings.chorusRate.toFixed(1)}hz`}
          onToggle={(checked) => onUpdate({ chorusEnabled: checked })}
          onChange={(value) => onUpdate({ chorusRate: value })}
        >
          <Slider
            value={settings.chorusDepth}
            max={1}
            min={0}
            step={0.01}
            sx={{
              width: 60, py: 0,
              '& .MuiSlider-track': { border: 'none', bgcolor: EFFECT_COLORS.chorus },
              '& .MuiSlider-thumb': { bgcolor: EFFECT_COLORS.chorus, width: 10, height: 10 },
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
        </EffectCard>
        <PipeConnector color={EFFECT_COLORS.chorus} active={settings.chorusEnabled} />

        {/* BitCrusher */}
        <EffectCard
          color={EFFECT_COLORS.bitcrusher}
          label="Bit Crush"
          tooltip={EFFECT_TOOLTIPS.bitcrusher}
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
        />
        <PipeConnector color={EFFECT_COLORS.bitcrusher} active={settings.bitcrusherEnabled} />

        {/* Filter */}
        <EffectCard
          color={EFFECT_COLORS.filter}
          label="Filter"
          tooltip={EFFECT_TOOLTIPS.filter}
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
        />
        <PipeConnector color={EFFECT_COLORS.filter} active={settings.filterEnabled} />

        {/* AutoPan */}
        <EffectCard
          color={EFFECT_COLORS.autoPan}
          label="Auto Pan"
          tooltip={EFFECT_TOOLTIPS.autoPan}
          enabled={settings.autoPanEnabled}
          sliderValue={settings.autoPanRate}
          sliderMin={0.1}
          sliderMax={20}
          sliderStep={0.1}
          displayValue={`${settings.autoPanRate.toFixed(1)}hz`}
          onToggle={(checked) => onUpdate({ autoPanEnabled: checked })}
          onChange={(value) => onUpdate({ autoPanRate: value })}
        >
          <Slider
            value={settings.autoPanDepth}
            max={1}
            min={0}
            step={0.01}
            sx={{
              width: 60, py: 0,
              '& .MuiSlider-track': { border: 'none', bgcolor: EFFECT_COLORS.autoPan },
              '& .MuiSlider-thumb': { bgcolor: EFFECT_COLORS.autoPan, width: 10, height: 10 },
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
        </EffectCard>
      </Box>
    </Box>
  )
}

export default EffectsChain