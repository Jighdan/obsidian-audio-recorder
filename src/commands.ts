import type { Plugin } from 'obsidian';
import type { RecorderState } from './recorder';
import type { RecordingController } from './recording-controller';

/**
 * Register the recording commands. Each can be bound to a hotkey in
 * Settings → Hotkeys. Commands that don't apply to the current state are
 * hidden from the palette and do nothing when their hotkey is pressed.
 */
export function registerCommands(plugin: Plugin, controller: RecordingController) {
	const when = (states: RecorderState[], run: () => void) => (checking: boolean) => {
		if (!states.includes(controller.state)) return false;
		if (!checking) run();
		return true;
	};

	plugin.addCommand({
		id: 'start-recording',
		name: 'Start recording',
		checkCallback: when(['idle'], () => void controller.startRecording()),
	});
	plugin.addCommand({
		id: 'pause-recording',
		name: 'Pause recording',
		checkCallback: when(['recording'], () => controller.togglePause()),
	});
	plugin.addCommand({
		id: 'resume-recording',
		name: 'Resume recording',
		checkCallback: when(['paused'], () => controller.togglePause()),
	});
	plugin.addCommand({
		id: 'stop-recording',
		name: 'Stop and save recording',
		checkCallback: when(['recording', 'paused'], () => void controller.stopRecording()),
	});
	plugin.addCommand({
		id: 'toggle-recording',
		name: 'Start/stop recording',
		callback: () => controller.toggleRecording(),
	});
	plugin.addCommand({
		id: 'toggle-pause',
		name: 'Pause/resume recording',
		checkCallback: when(['recording', 'paused'], () => controller.togglePause()),
	});
	plugin.addCommand({
		id: 'start-or-pause-recording',
		name: 'Start/pause/resume recording',
		callback: () => {
			if (controller.state === 'idle') void controller.startRecording();
			else controller.togglePause();
		},
	});
}
