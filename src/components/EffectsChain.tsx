import { FunctionComponent } from 'preact';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import EffectCard from './EffectCard';
import SnapControl from './SnapControl';
import {
  EFFECT_COLORS, EFFECT_TOOLTIPS,
  filterCutoffMarks, getScaleValue, getValueFromScale,
  humanFormat, noteToSeconds, noteToFrequency, Settings,
} from '../types';

interface Props {
  settings: Settings
  onUpdate: (partial: Partial<Settings>) => void
}

const EffectsChain: FunctionComponent<Props> = ({ settings, onUpdate }) => {
  const isDelaySync = settings.delaySyncEnabled

  const activeChain = [
    'Speed',
    ...(settings.reverseEnabled ? ['Rev'] : []),
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

      {/* Cards grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 1,
        alignItems: 'stretch',
      }}>
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

        {/* Reverse */}
        <EffectCard
          color={EFFECT_COLORS.reverse}
          label="Reverse"
          tooltip={EFFECT_TOOLTIPS.reverse}
          enabled={settings.reverseEnabled}
          onToggle={(checked) => onUpdate({ reverseEnabled: checked })}
        />

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

        {/* Phaser */}
        <EffectCard
          color={EFFECT_COLORS.phaser}
          label="Phaser"
          tooltip={EFFECT_TOOLTIPS.phaser}
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
          <SnapControl
            enabled={settings.phaserEnabled}
            syncEnabled={settings.phaserSyncEnabled}
            noteDivision={settings.phaserNoteDivision}
            color={EFFECT_COLORS.phaser}
            showFrequency
            bpm={settings.bpm}
            onToggleSync={(v) => onUpdate({ phaserSyncEnabled: v })}
            onChangeDivision={(v) => onUpdate({ phaserNoteDivision: v })}
          />
        </EffectCard>

        {/* Tremolo */}
        <EffectCard
          color={EFFECT_COLORS.tremolo}
          label="Tremolo"
          tooltip={EFFECT_TOOLTIPS.tremolo}
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
          <SnapControl
            enabled={settings.tremoloEnabled}
            syncEnabled={settings.tremoloSyncEnabled}
            noteDivision={settings.tremoloNoteDivision}
            color={EFFECT_COLORS.tremolo}
            showFrequency
            bpm={settings.bpm}
            onToggleSync={(v) => onUpdate({ tremoloSyncEnabled: v })}
            onChangeDivision={(v) => onUpdate({ tremoloNoteDivision: v })}
          />
        </EffectCard>

        {/* Reverb */}
        <EffectCard
          color={EFFECT_COLORS.reverb}
          label="Reverb"
          tooltip={EFFECT_TOOLTIPS.reverb}
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
        >
          <SnapControl
            enabled={settings.reverbEnabled}
            syncEnabled={settings.reverbSyncEnabled}
            noteDivision={settings.reverbNoteDivision}
            color={EFFECT_COLORS.reverb}
            bpm={settings.bpm}
            onToggleSync={(v) => onUpdate({ reverbSyncEnabled: v })}
            onChangeDivision={(v) => onUpdate({ reverbNoteDivision: v })}
          />
        </EffectCard>

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
          <SnapControl
            enabled={settings.delayEnabled}
            syncEnabled={settings.delaySyncEnabled}
            noteDivision={settings.delayNoteDivision}
            color={EFFECT_COLORS.delay}
            bpm={settings.bpm}
            onToggleSync={(v) => onUpdate({ delaySyncEnabled: v })}
            onChangeDivision={(v) => onUpdate({ delayNoteDivision: v })}
          />
        </EffectCard>

        {/* Chorus */}
        <EffectCard
          color={EFFECT_COLORS.chorus}
          label="Chorus"
          tooltip={EFFECT_TOOLTIPS.chorus}
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
          <SnapControl
            enabled={settings.chorusEnabled}
            syncEnabled={settings.chorusSyncEnabled}
            noteDivision={settings.chorusNoteDivision}
            color={EFFECT_COLORS.chorus}
            showFrequency
            bpm={settings.bpm}
            onToggleSync={(v) => onUpdate({ chorusSyncEnabled: v })}
            onChangeDivision={(v) => onUpdate({ chorusNoteDivision: v })}
          />
        </EffectCard>

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

        {/* AutoPan */}
        <EffectCard
          color={EFFECT_COLORS.autoPan}
          label="Auto Pan"
          tooltip={EFFECT_TOOLTIPS.autoPan}
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
          <SnapControl
            enabled={settings.autoPanEnabled}
            syncEnabled={settings.autoPanSyncEnabled}
            noteDivision={settings.autoPanNoteDivision}
            color={EFFECT_COLORS.autoPan}
            showFrequency
            bpm={settings.bpm}
            onToggleSync={(v) => onUpdate({ autoPanSyncEnabled: v })}
            onChangeDivision={(v) => onUpdate({ autoPanNoteDivision: v })}
          />
        </EffectCard>
      </Box>
    </Box>
  )
}

export default EffectsChain
