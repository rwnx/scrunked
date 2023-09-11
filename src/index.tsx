import { render, FunctionComponent } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as Tone from 'tone'
import { ChangeEventHandler } from 'preact/compat';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { Duration } from 'luxon';
import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Input from '@mui/material/Input';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import createTheme from '@mui/material/styles/createTheme';
import Typography from '@mui/material/Typography';
import GitHubIcon from '@mui/icons-material/GitHub';
import Link from '@mui/material/Link';

import { useThrottle } from "@uidotdev/usehooks";
import { getScaleValue, getValueFromScale, humanFormat } from './lib';
import WaveSurfer from 'wavesurfer.js';


type Settings = {
  filterCutoff: number,
  file: File | undefined,
  duration: number | undefined
  nextFile: File | undefined,
  speed: number,
  state: "ready" | "init"
}


const filterMax = 22_000

const mergeSettings = (next: Partial<Settings>) => (state: Settings) => ({
  ...state,
  ...next
})


const marks = [
  { value: getScaleValue(10), label: "10" },
  { value: getScaleValue(250), label: "250" },
  { value: getScaleValue(1_000), label: "1k" },
  { value: getScaleValue(2_500), label: "2.5k" },
  { value: getScaleValue(5_000), label: "5k" },
  { value: getScaleValue(9_000), label: "10k" },
  { value: getScaleValue(15_000), label: "15k" },
  { value: getScaleValue(22_000), label: "22k" },
]

const App: FunctionComponent = () => {
  const [settings, set] = useState<Settings>({
    filterCutoff: filterMax,
    speed: 1,
    file: undefined,
    duration: undefined,
    nextFile: undefined,
    state: "init"
  })

  const throttledSettings = useThrottle(settings, 250)

  const [player] = useState(new Tone.Player({ loop: true, autostart: false }))
  const [filter] = useState(new Tone.Filter(settings.filterCutoff, "lowpass"))
  const [comp] = useState(new Tone.Compressor(-10, 5))

  const waveformRef = useRef<HTMLDivElement | null>(null)
  const [waveform, setWaveform] = useState<WaveSurfer | undefined>()

  useEffect((() => {
    if (!waveformRef.current) return undefined
    if (waveform) {
      waveform.destroy()
    }
    const next = WaveSurfer.create({
      container: waveformRef.current,
      height: 100,
      waveColor: theme.palette.primary.main,
      progressColor: theme.palette.text.secondary,
      interact: false // TODO: enable and fix seeking
    })

    setWaveform(next)
  }), [waveformRef.current])

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = async (onChange) => {
    const file = onChange.currentTarget?.files?.[0]
    if (!file) throw new Error("missing file at upload time")

    set(mergeSettings({ nextFile: file }))
  }

  useEffect(() => {
    async function syncPlayerSettings() {
      if (settings.state === "init") {
        player.chain(
          filter,
          comp,
          Tone.Destination
        )

        set((prev) => ({
          ...prev,
          state: "ready",
        }))
        return
      }

      if (settings.nextFile) {
        const url = URL.createObjectURL(settings.nextFile)
        player.stop()
        await player.load(url)
        waveform?.loadBlob(settings.nextFile)
        player.start()
        set(mergeSettings({ file: settings.nextFile, nextFile: undefined, duration: player.buffer.duration }))
      }

      filter.set({ frequency: settings.filterCutoff })
      player.set({ playbackRate: settings.speed })
    }

    syncPlayerSettings()
  }, [throttledSettings, waveform])


  const handlePlayPauseToggle = () => {
    if (!player) return
    if (player.state === "started") {
      player.stop()
    } else {
      player.start(0)
    }
  }

  const theme = createTheme({})
  return (<>
    <CssBaseline />
    <ThemeProvider theme={theme}>
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
        minHeight="100vh"
      >
        <Card sx={{ width: 500, padding: 3 }}>
          <Typography variant="h5" component="div">scrunked</Typography>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>a toolkit for ruining your favourite music</Typography>
          <CardContent>

            <Input type="file" sx={{ width: "100%", pt: 1, pb: 1 }} onChange={handleFileChange} accept={"audio/wav, audio/ogg, audio/mp3, audio/flac, audio/acc, audio/mpeg"} />
            {settings.file || settings.nextFile ? <>
              <Grid container spacing={2}>
                  <Grid item xs={2}>
                    <Box display="flex" height="100%" justifyContent="center" alignItems="center">
                      <Button onClick={handlePlayPauseToggle}>{<PlayArrowIcon />}</Button>
                    </Box>
                  </Grid>
                  <Grid item xs={9}>
                    <Box sx={{ m: 1 }} ref={waveformRef}></Box>
                  </Grid>
                  <Grid item xs={1}>
                    <Box display="flex" height="100%" justifyContent="center" alignItems="center">
                      {Duration.fromObject({ seconds: settings.duration }).toFormat("mm:ss")}
                    </Box>
                  </Grid>
                </Grid>

            </> : null}

            <Grid container mt={2} spacing={2}>
              <Grid item xs={2}>Speed</Grid>
              <Grid item xs={9}>
                <Slider
                  value={settings.speed}
                  max={2}
                  min={0.1}
                  step={0.01}
                  marks={[
                    { value: 0.1 },
                    { value: 0.5 },
                    { value: 1 },
                    { value: 1.5 },
                    { value: 2 },
                  ]}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ speed: value }))
                  }}
                />
              </Grid>
              <Grid item xs={1}>
                {settings.speed}x
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={2}><span>Filter</span></Grid>
              <Grid item xs={9}>
                <Slider
                  value={getScaleValue(settings.filterCutoff)}
                  max={marks[marks.length - 1].value}
                  min={1}
                  step={0.1}
                  marks={marks}
                  onChange={(e, value) => {
                    if (Array.isArray(value)) throw new Error("single value required")
                    set(mergeSettings({ filterCutoff: getValueFromScale(value) }))
                  }}
                />
              </Grid>
              <Grid item xs={1}>
                {humanFormat(settings.filterCutoff)}hz
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Typography sx={{ fontSize: 14, mt: 1 }} color="text.secondary">Inspired by <Link href="https://github.com/dumbmatter/screw">Screw</Link> 🔩 Built with love by <Link href="https://github.com/rwnx">Rowan</Link>✨</Typography>

        <Typography sx={{ mt: 1 }} color="text.secondary"> <Button href={"https://github.com/rwnx/scrunked"}><GitHubIcon sx={{ mr: 0.5 }} />view on github</Button> </Typography>
      </Box>
    </ThemeProvider>
  </>
  );
}
const appNode = document.getElementById('app')
if (!appNode) throw new Error("unable to find app node")

render(<App />, appNode);
