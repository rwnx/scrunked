import { render, FunctionComponent } from 'preact';
import "./style.css"
import { Button, Card, CardContent, Grid, Input, Slider } from '@mui/material';
import { useEffect, useRef, useState } from 'preact/hooks';
import * as Tone from 'tone'
import { ChangeEventHandler } from 'preact/compat';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { Duration } from 'luxon';

type Settings = {
	filterCutoff: number,
	reverb: number,
	limit: number,
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
	if(value > 99) return `${Math.round(value/10)/10}K`
	if(value > 999) return `${Math.round(value/1000)}K`
	return Math.round(value)
}


const App: FunctionComponent = () => {
	const [settings, set] = useState<Settings>({
		filterCutoff: filterMax,
		playback: 1,
		reverb: 0.1,
		limit: -1,
		file: undefined,
		nextFile: undefined,
	})

	const filter = useRef(new Tone.Filter(settings.filterCutoff, "lowpass"))
	const limiter = useRef(new Tone.Limiter(settings.limit))
	const reverb = useRef(new Tone.Reverb(settings.reverb))

	const player = useRef<Tone.Player>(new Tone.Player({ loop: true, autostart: false }).chain(
		filter.current,
		reverb.current,
		limiter.current,
		Tone.Destination
	))

	const playbackTick = useRef<number>()
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
				await (await player.current.load(url)).start()
				set(mergeSettings({ file: settings.nextFile, nextFile: undefined }))
				setPlaybackState({ state: "started", time: 0 })
			}

			filter.current.set({ frequency: settings.filterCutoff })
			player.current.set({ playbackRate: settings.playback })
			reverb.current.set({ decay: settings.reverb })
		}

		syncPlayerSettings()

		return () => {
			// player.current.dispose()
		}

	}, [settings, filter.current, player, reverb.current])


	useEffect(() => {
		function queueTimedUpdate() {
			playbackTick.current = setTimeout(() => {
				setPlaybackState({
					time: player.current.sampleTime,
					state: player.current.state
				})
				window.clearTimeout(playbackTick.current)
				queueTimedUpdate()

			}, 100)
		}

		queueTimedUpdate()

		return () => {
			window.clearTimeout(playbackTick.current)
		}
	}, [])

	const handlePlayPauseToggle = () => {
		if (player.current.state === "started") {
			player.current.stop()
			setPlaybackState({
				time: 0,
				state: "stopped"
			})

		} else {
			player.current.start(0)
			setPlaybackState({
				time: player.current.context.currentTime,
				state: "started"
			})
		}
		console.log("handlePlayPauseToggle", playbackState)

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
							max={player.current.buffer.duration}
							min={0}
							step={1}
							onChange={(e, value) => {
								if (Array.isArray(value)) throw new Error("single value required")
								player.current.stop().start(value)
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
							max={getScaleValue(filterMax)}
							min={1}
							step={0.1}
							marks={[
								{ value: getScaleValue(10), label: "10" },
								{ value: getScaleValue(250), label: "250" },
								{ value: getScaleValue(1_000), label: "1k" },
								{ value: getScaleValue(2_500), label: "2.5k" },
								{ value: getScaleValue(5_000), label: "5k" },
								{ value: getScaleValue(10_000), label: "10k" },
								{ value: getScaleValue(15_000), label: "15k" },
								{ value: getScaleValue(22_000), label: "22k" },
							]}
							onChange={(e, value) => {
								if (Array.isArray(value)) throw new Error("single value required")
								set(mergeSettings({ filterCutoff: getValueFromScale(value) }))

							}}
						/>
					</Grid>
					<Grid item xs={1}>
						{humanFormat(settings.filterCutoff)}
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
