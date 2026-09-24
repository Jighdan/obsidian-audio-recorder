import { Notice, TFile } from 'obsidian';
import type AudioRecorderPlugin from './main';
import { matchesFile } from './matcher';
import { AudioRecorder, RecorderState } from './recorder';
import { saveRecording } from './save-recording';
import { FloatingButton } from './ui/floating-button';
import { RecorderModal } from './ui/recorder-modal';

/** Runs a recording session and keeps the floating button and recorder dialog in sync with it. */
export class RecordingController {
	private recorder = new AudioRecorder();
	private button: FloatingButton;
	private modal: RecorderModal;
	/** Whether the recorder dialog is open (not minimised). */
	private expanded = false;
	private tickTimer: number | null = null;
	/** The note the current recording belongs to. */
	private targetFile: TFile | null = null;

	constructor(private plugin: AudioRecorderPlugin) {
		this.button = new FloatingButton(document.body, {
			onStart: () => void this.startRecording(),
			onExpand: () => this.openRecorder(),
		});
		this.modal = new RecorderModal(plugin.app, {
			onPauseToggle: () => this.togglePause(),
			onStop: () => void this.stopRecording(),
			onDiscard: () => this.discardRecording(),
			onClose: () => {
				this.expanded = false;
				this.updateUi();
			},
		});
	}

	destroy() {
		this.stopTicking();
		this.recorder.discard();
		this.modal.close();
		this.button.destroy();
	}

	get state(): RecorderState {
		return this.recorder.state;
	}

	toggleRecording() {
		if (this.recorder.state === 'idle') void this.startRecording();
		else void this.stopRecording();
	}

	/** Show the button on matching notes, and always while a recording is in progress. */
	refreshVisibility() {
		const { app, settings } = this.plugin;
		const active = app.workspace.getActiveFile();
		const visible = this.recorder.state !== 'idle' || matchesFile(app, active, settings);
		this.button.setVisible(visible);
	}

	async startRecording() {
		const file = this.plugin.app.workspace.getActiveFile();
		if (!file) {
			new Notice('Open a note to record into.');
			return;
		}
		try {
			await this.recorder.start();
		} catch (err) {
			console.error('Audio recorder: could not start recording', err);
			new Notice('Could not access the microphone.');
			return;
		}
		this.targetFile = file;
		this.modal.setTarget(file.name);
		this.startTicking();
		this.openRecorder();
		this.refreshVisibility();
	}

	/** Open the recorder dialog for the recording in progress. */
	openRecorder() {
		if (this.recorder.state === 'idle' || this.expanded) return;
		this.expanded = true;
		this.modal.open();
		this.updateUi();
	}

	togglePause() {
		if (this.recorder.state === 'recording') this.recorder.pause();
		else if (this.recorder.state === 'paused') this.recorder.resume();
		this.updateUi();
	}

	async stopRecording() {
		const target = this.targetFile;
		const recording = await this.recorder.stop();
		this.resetUi();
		if (!recording || !target) return;
		try {
			const audioFile = await saveRecording(this.plugin.app, this.plugin.settings, recording, target);
			new Notice(`Saved ${audioFile.name}`);
		} catch (err) {
			console.error('Audio recorder: could not save recording', err);
			new Notice('Could not save the recording.');
		}
	}

	private discardRecording() {
		this.recorder.discard();
		this.resetUi();
		new Notice('Recording discarded.');
	}

	/** Sync the floating control and the dialog with the recorder. */
	private updateUi() {
		const state = this.recorder.state;
		this.button.setState(state, this.expanded);
		this.modal.setState(state);
		this.button.setElapsed(this.recorder.elapsedMs);
		this.modal.setElapsed(this.recorder.elapsedMs);
	}

	private resetUi() {
		this.stopTicking();
		this.targetFile = null;
		this.modal.close();
		this.updateUi();
		this.refreshVisibility();
	}

	private startTicking() {
		this.stopTicking();
		// ~16fps for the level meter; the timer rides along.
		this.tickTimer = window.setInterval(() => {
			const elapsed = this.recorder.elapsedMs;
			this.button.setElapsed(elapsed);
			if (!this.expanded) return;
			this.modal.setElapsed(elapsed);
			if (this.recorder.state === 'recording') this.modal.pushLevel(this.recorder.level);
		}, 1000 / 16);
		this.plugin.registerInterval(this.tickTimer);
	}

	private stopTicking() {
		if (this.tickTimer !== null) window.clearInterval(this.tickTimer);
		this.tickTimer = null;
	}
}
