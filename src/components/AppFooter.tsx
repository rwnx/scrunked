import { FunctionComponent } from 'preact';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import GitHubIcon from '@mui/icons-material/GitHub';
import { SvgIcon } from '@mui/material';
import { ChromeIcon } from '../icons';
import Changelog from '../Changelog';

const AppFooter: FunctionComponent = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      flexWrap: 'wrap',
      mt: 2,
      px: 2,
      pb: 1,
    }}
  >
    <Typography sx={{ fontSize: 12 }} color="text.secondary">
      Inspired by <Link href="https://github.com/dumbmatter/screw" sx={{ fontSize: 12 }}>Screw</Link> 🔩
    </Typography>
    <Typography sx={{ fontSize: 12, display: 'flex', gap: 0.5, alignItems: 'center' }} color="text.secondary">
      Best in <SvgIcon fontSize="small">{ChromeIcon}</SvgIcon> Chrome
    </Typography>
    <Changelog />
    <Button
      href="https://github.com/rwnx/scrunked"
      size="small"
      variant="text"
      sx={{ fontSize: 12, textTransform: 'none', color: 'text.secondary' }}
    >
      <GitHubIcon sx={{ mr: 0.5, fontSize: 14 }} />
      GitHub
    </Button>
  </Box>
)

export default AppFooter
