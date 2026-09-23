import { MarkdownView, normalizePath, Notice, Plugin, TFile } from 'obsidian';
import { AudioButtonSettings, AudioButtonSettingTab, DEFAULT_SETTINGS } from './settings';
import { matchesFile } from './matcher';
import { AudioRecorder, extensionFor, Recording } from './recorder';
import { FloatingButton } from './ui/floating-button';

export default class AudioButtonPlugin extends Plugin {
	settings!: AudioButtonSettings;
	private recorder = new AudioRecorder();
	private button!: FloatingButton;
	private tickTimer: number | null = null;
	/** The note the current recording belongs to. */
	private targetFile: TFile | null = null;

	async onload() {
		await this.loadSettings();

		this.button = new FloatingButton(document.body, {
			onStart: () => void this.startRecording(),
			onPauseToggle: () => this.togglePause(),
			onStop: () => void this.stopRecording(),
			onDiscard: () => this.discardRecording(),
		});

		this.addSettingTab(new AudioButtonSettingTab(this.app, this));

		this.addCommand({
			id: 'toggle-recording',
			name: 'Start/stop recording',
			callback: () => {
				if (this.recorder.state === 'idle') void this.startRecording();
				else void this.stopRecording();
			},
		});
		this.addCommand({
			id: 'toggle-pause',
			name: 'Pause/resume recording',
			checkCallback: (checking) => {
				if (this.recorder.state === 'idle') return false;
				if (!checking) this.togglePause();
				return true;
			},
		});

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
	}

	onunload() {
		this.stopTicking();
		this.recorder.discard();
		this.button.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AudioButtonSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshVisibility();
	}

	/** Show the button on matching notes, and always while a recording is in progress. */
	refreshVisibility() {
		const active = this.app.workspace.getActiveFile();
		const visible = this.recorder.state !== 'idle' || matchesFile(this.app, active, this.settings);
		this.button.setVisible(visible);
	}

	private async startRecording() {
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
		this.button.setState('recording');
		this.startTicking();
		this.refreshVisibility();
	}

	private togglePause() {
		if (this.recorder.state === 'recording') this.recorder.pause();
		else if (this.recorder.state === 'paused') this.recorder.resume();
		this.button.setState(this.recorder.state);
		this.button.setElapsed(this.recorder.elapsedMs);
	}

	private async stopRecording() {
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
		this.button.setState('idle');
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
		this.tickTimer = window.setInterval(() => {
			this.button.setElapsed(this.recorder.elapsedMs);
		}, 250);
		this.registerInterval(this.tickTimer);
	}

	private stopTicking() {
		if (this.tickTimer !== null) window.clearInterval(this.tickTimer);
		this.tickTimer = null;
	}
}
