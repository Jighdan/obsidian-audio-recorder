import type AudioButtonPlugin from './main';
import type { RecorderState } from './recorder';

/**
 * Register the recording commands. Each can be bound to a hotkey in
 * Settings → Hotkeys. Commands that don't apply to the current state are
 * hidden from the palette and do nothing when their hotkey is pressed.
 */
export function registerCommands(plugin: AudioButtonPlugin) {
	const when = (states: RecorderState[], run: () => void) => (checking: boolean) => {
		if (!states.includes(plugin.recordingState)) return false;
		if (!checking) run();
		return true;
	};

	plugin.addCommand({
		id: 'start-recording',
		name: 'Start recording',
		checkCallback: when(['idle'], () => void plugin.startRecording()),
	});
	plugin.addCommand({
		id: 'pause-recording',
		name: 'Pause recording',
		checkCallback: when(['recording'], () => plugin.togglePause()),
	});
	plugin.addCommand({
		id: 'resume-recording',
		name: 'Resume recording',
		checkCallback: when(['paused'], () => plugin.togglePause()),
	});
	plugin.addCommand({
		id: 'stop-recording',
		name: 'Stop and save recording',
		checkCallback: when(['recording', 'paused'], () => void plugin.stopRecording()),
	});
	plugin.addCommand({
		id: 'toggle-recording',
		name: 'Start/stop recording',
		callback: () => plugin.toggleRecording(),
	});
	plugin.addCommand({
		id: 'toggle-pause',
		name: 'Pause/resume recording',
		checkCallback: when(['recording', 'paused'], () => plugin.togglePause()),
	});
	plugin.addCommand({
		id: 'start-or-pause-recording',
		name: 'Start/pause/resume recording',
		callback: () => {
			if (plugin.recordingState === 'idle') void plugin.startRecording();
			else plugin.togglePause();
		},
	});
}
