import { MarkdownView, normalizePath, Notice, Plugin, TFile } from 'obsidian';
import { AudioButtonSettings, AudioButtonSettingTab, loadSettings } from './settings';
import { registerCommands } from './commands';
import { matchesFile } from './matcher';
import { AudioRecorder, extensionFor, Recording, RecorderState } from './recorder';
import { FloatingButton } from './ui/floating-button';
import { RecorderModal } from './ui/recorder-modal';

export default class AudioButtonPlugin extends Plugin {
	settings!: AudioButtonSettings;
	private recorder = new AudioRecorder();
	private button!: FloatingButton;
	private modal!: RecorderModal;
	/** Whether the recorder dialog is open (not minimised). */
	private expanded = false;
	private tickTimer: number | null = null;
	/** The note the current recording belongs to. */
	private targetFile: TFile | null = null;
	private ribbonIcon: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.button = new FloatingButton(document.body, {
			onStart: () => void this.startRecording(),
			onExpand: () => this.openRecorder(),
		});
		this.modal = new RecorderModal(this.app, {
			onPauseToggle: () => this.togglePause(),
			onStop: () => void this.stopRecording(),
			onDiscard: () => this.discardRecording(),
			onClose: () => {
				this.expanded = false;
				this.updateUi();
			},
		});

		this.addSettingTab(new AudioButtonSettingTab(this.app, this));

		registerCommands(this);

		const refresh = () => this.refreshVisibility();
		this.registerEvent(this.app.workspace.on('active-leaf-change', refresh));
		this.registerEvent(this.app.workspace.on('file-open', refresh));
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file === this.app.workspace.getActiveFile()) refresh();
			}),
		);
		this.registerEvent(this.app.vault.on('rename', refresh));
		this.app.workspace.onLayoutReady(refresh);
		this.updateRibbonIcon();
	}

	onunload() {
		this.stopTicking();
		this.recorder.discard();
		this.modal.close();
		this.button.destroy();
	}

	async loadSettings() {
		this.settings = loadSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshVisibility();
		this.updateRibbonIcon();
	}

	/** Add or remove the left sidebar record button to match the setting. */
	private updateRibbonIcon() {
		if (this.settings.showRibbonIcon && !this.ribbonIcon) {
			this.ribbonIcon = this.addRibbonIcon('mic', 'Start/stop recording', () =>
				this.toggleRecording(),
			);
		} else if (!this.settings.showRibbonIcon && this.ribbonIcon) {
			this.ribbonIcon.remove();
			this.ribbonIcon = null;
		}
	}

	get recordingState(): RecorderState {
		return this.recorder.state;
	}

	toggleRecording() {
		if (this.recorder.state === 'idle') void this.startRecording();
		else void this.stopRecording();
	}

	/** Show the button on matching notes, and always while a recording is in progress. */
	refreshVisibility() {
		const active = this.app.workspace.getActiveFile();
		const visible = this.recorder.state !== 'idle' || matchesFile(this.app, active, this.settings);
		this.button.setVisible(visible);
	}

	async startRecording() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice('Open a note to record into.');
			return;
		}
		try {
			await this.recorder.start();
		} catch (err) {
			console.error('Audio button: could not start recording', err);
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

	/** Sync the floating control and the dialog with the recorder. */
	private updateUi() {
		const state = this.recorder.state;
		this.button.setState(state, this.expanded);
		this.modal.setState(state);
		this.button.setElapsed(this.recorder.elapsedMs);
		this.modal.setElapsed(this.recorder.elapsedMs);
	}

	async stopRecording() {
		const target = this.targetFile;
		const recording = await this.recorder.stop();
		this.resetUi();
		if (!recording || !target) return;
		try {
			await this.saveRecording(recording, target);
		} catch (err) {
			console.error('Audio button: could not save recording', err);
			new Notice('Could not save the recording.');
		}
	}

	private discardRecording() {
		this.recorder.discard();
		this.resetUi();
		new Notice('Recording discarded.');
	}

	private resetUi() {
		this.stopTicking();
		this.targetFile = null;
		this.modal.close();
		this.updateUi();
		this.refreshVisibility();
	}

	private async saveRecording(recording: Recording, target: TFile) {
		const stamp = window.moment().format('YYYY-MM-DD HH.mm.ss');
		const filename = `Recording ${stamp}.${extensionFor(recording.mimeType)}`;
		const path = await this.getRecordingPath(filename, target);
		const audioFile = await this.app.vault.createBinary(path, await recording.blob.arrayBuffer());

		const embed = '!' + this.app.fileManager.generateMarkdownLink(audioFile, target.path);
		await this.insertEmbed(target, embed);
		new Notice(`Saved ${audioFile.name}`);
	}

	private async getRecordingPath(filename: string, target: TFile): Promise<string> {
		const folder = this.settings.recordingsFolder;
		if (!folder) {
			return this.app.fileManager.getAvailablePathForAttachment(filename, target.path);
		}
		if (!this.app.vault.getFolderByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}
		let path = normalizePath(`${folder}/${filename}`);
		for (let i = 1; this.app.vault.getAbstractFileByPath(path); i++) {
			path = normalizePath(`${folder}/${filename.replace(/(\.\w+)$/, ` ${i}$1`)}`);
		}
		return path;
	}

	private async insertEmbed(target: TFile, embed: string) {
		if (this.settings.insertPosition === 'cursor') {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view && view.file === target && view.getMode() === 'source') {
				view.editor.replaceSelection(embed + '\n');
				return;
			}
		}
		await this.app.vault.process(target, (data) => {
			const sep = data.length === 0 || data.endsWith('\n') ? '' : '\n';
			return `${data}${sep}\n${embed}\n`;
		});
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
		this.registerInterval(this.tickTimer);
	}

	private stopTicking() {
		if (this.tickTimer !== null) window.clearInterval(this.tickTimer);
		this.tickTimer = null;
	}
}
