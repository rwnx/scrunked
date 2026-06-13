import { FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AudioFileIcon from '@mui/icons-material/AudioFile';

interface Props {
  hasFile: boolean
  fileName?: string
  onFile: (file: File) => void
}

const FileDropArea: FunctionComponent<Props> = ({ hasFile, fileName, onFile }) => {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: preact.JSX.TargetedDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: preact.JSX.TargetedDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: preact.JSX.TargetedDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      onFile(file)
    }
  }

  const handleChange = (e: preact.JSX.TargetedEvent<HTMLInputElement>) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) onFile(file)
  }

  if (hasFile) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: `${fileName ? 'primary' : 'action'}.hover`,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <AudioFileIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500, flex: 1 }} noWrap>
          {fileName || 'No file loaded'}
        </Typography>
        <Typography
          variant="caption"
          component="label"
          sx={{
            color: 'primary.main',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 11,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Change
          <input type="file" hidden accept="audio/*" onChange={handleChange} />
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      component="label"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 3,
        px: 2,
        borderRadius: 3,
        border: '2px dashed',
        borderColor: isDragging ? 'primary.main' : 'divider',
        bgcolor: isDragging ? 'action.selected' : 'action.hover',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.selected',
        },
      }}
    >
      <input type="file" hidden accept="audio/*" onChange={handleChange} />
      <CloudUploadIcon
        sx={{
          fontSize: 36,
          color: isDragging ? 'primary.main' : 'text.disabled',
          transition: 'color 0.3s',
        }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, textAlign: 'center' }}>
        {isDragging ? 'Drop your audio file here' : 'Drop audio file or click to browse'}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
        Supports WAV, MP3, OGG, FLAC, AAC
      </Typography>
    </Box>
  )
}

export default FileDropArea
