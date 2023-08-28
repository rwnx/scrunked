import { render, FunctionComponent } from 'preact';
import "./style.css"
import { Button, Card, CardContent, Grid, Input, Slider } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as Tone from 'tone'
import { ChangeEventHandler } from 'preact/compat';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { Duration } from 'luxon';

type Settings = {
	filterCutoff: number,
	reverb: number,
	file: File | undefined,
	nextFile: File | undefined,
	playback: number,
}

type PlaybackState = {
	time: number,
	state: "started" | "paused" | "stopped"
}

const scalePower = 2.5
const getScaleValue = (value: number) => Math.pow(Math.abs(value), 1 / scalePower)
const getValueFromScale = (value: number) => Math.pow(value, scalePower)
const filterMax = 22_000

const mergeSettings = (next: Partial<Settings>) => (state: Settings) => ({
	...state,
	...next
})

const humanFormat = (value: number) => {
	if(value > 9999) return `${Math.round(value/1000)}K`
	if(value > 999) return `${Math.round(value/100)/10}K`
	return Math.round(value)
}

const marks = [
	{ value: getScaleValue(10), label: "10" },
	{ value: getScaleValue(250), label: "250" },
	{ value: getScaleValue(1_000), label: "1k" },
	{ value: getScaleValue(2_500), label: "2.5k" },
	{ value: getScaleValue(5_000), label: "5k" },
	{ value: getScaleValue(10_000), label: "10k" },
	{ value: getScaleValue(15_000), label: "15k" },
	{ value: getScaleValue(22_000), label: "22k" },
]



const App: FunctionComponent = () => {
	const [settings, set] = useState<Settings>({
		filterCutoff: filterMax,
		playback: 1,
		reverb: 0.1,
		file: undefined,
		nextFile: undefined,
	})

	const [filter] = useState(new Tone.Filter(settings.filterCutoff, "lowpass"))
	const [reverb] = useState(new Tone.Reverb(settings.reverb))

	const [player, setPlayer] = useState<Tone.Player>(new Tone.Player({ loop: true, autostart: false }))
	useEffect(() => {
		setPlayer( new Tone.Player({ loop: true, autostart: false }).chain(
			filter,
			reverb,
			Tone.Destination
		))

		return () => {
			// console.log("Player DISPOSAL")  
		}
	}, [filter, reverb])

	const [playbackState, setPlaybackState] = useState<PlaybackState>({ state: "paused", time: 0 })

	const handleFileChange: ChangeEventHandler<HTMLInputElement> = async (onChange) => {
		const file = onChange.currentTarget?.files?.[0]
		if (!file) throw new Error("missing file at upload time")

		set(mergeSettings({ nextFile: file }))
	}

	useEffect(() => {
		async function syncPlayerSettings() {
			if (settings.nextFile) {
				const url = URL.createObjectURL(settings.nextFile)
				await (await player.load(url)).start()
				set(mergeSettings({ file: settings.nextFile, nextFile: undefined }))
				setPlaybackState({ state: "started", time: 0 })
			}

			filter.set({ frequency: settings.filterCutoff })
			player.set({ playbackRate: settings.playback })
			reverb.set({ decay: settings.reverb })
		}

		syncPlayerSettings()
	}, [settings, filter, player, reverb])


	const handlePlayPauseToggle = () => {
		if (player.state === "started") {
			player.stop()
			setPlaybackState({
				time: 0,
				state: "stopped"
			})

		} else {
			player.start(0)
			setPlaybackState({
				time: player.context.currentTime,
				state: "started"
			})
		}
	}
	return (<>
		<Card sx={{ minWidth: 500, padding: 3 }}>
			<CardContent>
				<Input type="file" onChange={handleFileChange} accept={"audio/wav, audio/ogg, audio/mp3, audio/flac, audio/acc, audio/mpeg"} />

				<Grid container spacing={2}>
				<Grid item xs={2} sx={{marginBottom: 5}}>
					<Button disabled={!settings.file} onClick={handlePlayPauseToggle}>{playbackState.state === "paused" ? <PlayArrowIcon /> : <PauseIcon />}</Button>
					</Grid>
					<Grid item xs={9}>
						<Slider
							// TODO: disabled pending implementation
							disabled={true}
							value={playbackState.time}
							max={player.buffer.duration}
							min={0}
							step={1}
							onChange={(e, value) => {
								if (Array.isArray(value)) throw new Error("single value required")
								player.stop().start(value)
								setPlaybackState((state) => ({ ...state, time: value }))
							}}
						/>
					</Grid>
					<Grid item xs={1}>
						{Duration.fromObject({seconds: playbackState.time}).toFormat("mm:ss")}
					</Grid>

				</Grid>

				<Grid container spacing={2}>
					<Grid item xs={2}><span>Reverb</span></Grid>
					<Grid item xs={9}>
						<Slider
							value={settings.reverb}
							max={3}
							min={0.1}
							step={0.1}
							onChange={(e, value) => {
								if (Array.isArray(value)) throw new Error("single value required")
								set(mergeSettings({ reverb: value }))
							}}
						/>
					</Grid>
					<Grid item xs={1}>
						{settings.reverb}s
					</Grid>
				</Grid>

				<Grid container spacing={2}>
					<Grid item xs={2}><span>Speed</span></Grid>
					<Grid item xs={9}>
						<Slider
							value={settings.playback}
							max={2}
							min={0.1}
							step={0.1}
							marks={[
								{ value: 0.1},
								{ value: 0.5},
								{ value: 1},
								{ value: 1.5},
								{ value: 2 },
							]}
							onChange={(e, value) => {
								if (Array.isArray(value)) throw new Error("single value required")
								set(mergeSettings({ playback: value }))
							}}
						/>
					</Grid>
					<Grid item xs={1}>
						{settings.playback}x
					</Grid>
				</Grid>
				<Grid container spacing={2}>
					<Grid item xs={2}><span>Filter</span></Grid>
					<Grid item xs={9}>
						<Slider
							value={getScaleValue(settings.filterCutoff)}
							max={marks[marks.length-1].value}
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
		</>
	);
}
const appNode = document.getElementById('app')
if (!appNode) throw new Error("unable to find app node")

render(<App />, appNode);
