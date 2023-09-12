import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { parser } from "keep-a-changelog";
import { DateTime } from "luxon";
import { useQuery } from "react-query";

export const useChangelogQuery = () => {
  return useQuery(["changelog"], async () => {
    const data = await fetch("CHANGELOG.md").then(response => response.text())

    const parsed = parser(data)

    const latestReleased = parsed.releases[1]
    if(!latestReleased.version || !latestReleased.date) throw new Error("changelog missing required fields")

    return parsed
  }, {retry: false})
}

/**
 * Fetches the changelog dynamically and parses the last release
 * this relies on CHANGELOG.md being available at runtime. see vite.config.ts for vite-plugin-static-copy config
 */
const Changelog: React.FunctionComponent = () => {
  const changelogQuery = useChangelogQuery()

  if (changelogQuery.isLoading) return <Typography sx={{ fontSize: 14, mt: 1 }} color="text.secondary">Loading...</Typography>
  if (changelogQuery.isError || !changelogQuery.data) return <Typography sx={{ fontSize: 14, mt: 1 }} color="warning.main">Unable to load <Link color="warning.main" href="https://github.com/rwnx/scrunked/CHANGELOG.md">CHANGELOG.md</Link></Typography>

  const {data} = changelogQuery
  const latestReleased = data.releases[1]
  if(!latestReleased.version || !latestReleased.date) throw new Error("changelog missing required fields")

  return <Box sx={{ mt: 2}} >
    <Typography sx={{fontSize: 14,textDecoration: "underline"}} color="text.secondary">Latest Release</Typography>
      <Box display="flex" gap={1} alignItems="center">
    <Typography sx={{fontSize: 14,fontWeight: "bold"}}>{latestReleased.version.raw}</Typography>
    <Typography sx={{ fontSize: 14}} color="text.secondary">{DateTime.fromJSDate(latestReleased.date).toRelativeCalendar({})} </Typography>
    </Box>
    <Typography sx={{ fontSize: 14, mt: 1 }} color="text.secondary">
      {latestReleased.description}
    </Typography>
    </Box>
}


export default Changelog
