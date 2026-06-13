import { FunctionComponent, RefObject } from 'preact';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Duration } from 'luxon';

interface Props {
  isPlaying: boolean
  isExporting: boolean
  duration: number | undefined
  hasFile: boolean
  waveformRef: RefObject<HTMLDivElement>
  onPlayPause: () => void
  onExport: () => void
}

const TransportBar: FunctionComponent<Props> = ({
  isPlaying,
  isExporting,
  duration,
  hasFile,
  waveformRef,
  onPlayPause,
  onExport,
}) => {
  if (!hasFile) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 2 },
        mt: 1.5,
        mb: 1,
        bgcolor: 'action.hover',
        borderRadius: 3,
        p: { xs: 1, sm: 1.5 },
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Button
        variant="contained"
        color="primary"
        onClick={onPlayPause}
        sx={{
          minWidth: 44,
          minHeight: 44,
          width: 44,
          height: 44,
          borderRadius: '50%',
          flexShrink: 0,
          p: 0,
          boxShadow: isPlaying ? 4 : 1,
          transition: 'all 0.2s ease',
          '&:hover': { transform: 'scale(1.05)' },
        }}
      >
        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
      </Button>

      <Box sx={{ flex: 1, minWidth: 0 }} ref={waveformRef} />

      <Typography
        variant="caption"
        sx={{
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontFamily: 'monospace',
        }}
        color="text.secondary"
      >
        {duration ? Duration.fromObject({ seconds: duration }).toFormat("mm:ss") : "--:--"}
      </Typography>

      <Tooltip title="Export processed audio as WAV">
        <span>
          <Button
            variant="outlined"
            size="small"
            onClick={onExport}
            disabled={isExporting}
            sx={{
              minWidth: 36,
              minHeight: 36,
              borderRadius: '50%',
              p: 0,
              borderColor: 'divider',
              '&:hover': { borderColor: 'text.primary' },
            }}
          >
            {isExporting ? (
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700 }}>...</Typography>
            ) : (
              <FileDownloadIcon sx={{ fontSize: 18 }} />
            )}
          </Button>
        </span>
      </Tooltip>
    </Box>
  )
}

export default TransportBar
