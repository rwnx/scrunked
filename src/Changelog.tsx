import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { parser } from "keep-a-changelog";
import { DateTime } from "luxon";
import changelogRaw from "../CHANGELOG.md?raw";

const parsed = parser(changelogRaw)
const latestRelease = parsed.releases[1]
if (!latestRelease) throw new Error("changelog missing release at index 1")
if (!latestRelease.version || !latestRelease.date) throw new Error("changelog missing required fields")

const version = latestRelease.version.raw
const date = latestRelease.date
const description = latestRelease.description

/**
 * Displays the latest release info from CHANGELOG.md, inlined at build time
 * via Vite's `?raw` import — no runtime fetch needed.
 */
const Changelog: React.FunctionComponent = () => {
  return <Box sx={{ mt: 2}} >
    <Typography sx={{fontSize: 14,textDecoration: "underline"}} color="text.secondary">Latest Release</Typography>
      <Box display="flex" gap={1} alignItems="center">
    <Typography sx={{fontSize: 14,fontWeight: "bold"}}>{version}</Typography>
    <Typography sx={{ fontSize: 14}} color="text.secondary">{DateTime.fromJSDate(date).toRelativeCalendar({})} </Typography>
    </Box>
    <Typography sx={{ fontSize: 14, mt: 1 }} color="text.secondary">
      {description}
    </Typography>
    </Box>
}


export default Changelog
