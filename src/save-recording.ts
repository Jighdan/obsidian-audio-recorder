import { App, MarkdownView, normalizePath, TFile } from 'obsidian';
import { extensionFor, Recording } from './recorder';
import type { AudioRecorderSettings } from './settings';

/** Save the recording to the vault and embed it in the target note. Returns the new audio file. */
export async function saveRecording(
	app: App,
	settings: AudioRecorderSettings,
	recording: Recording,
	target: TFile,
): Promise<TFile> {
	const stamp = window.moment().format('YYYY-MM-DD HH.mm.ss');
	const filename = `Recording ${stamp}.${extensionFor(recording.mimeType)}`;
	const path = await getRecordingPath(app, settings, filename, target);
	const audioFile = await app.vault.createBinary(path, await recording.blob.arrayBuffer());

	const embed = '!' + app.fileManager.generateMarkdownLink(audioFile, target.path);
	await insertEmbed(app, settings, target, embed);
	return audioFile;
}

async function getRecordingPath(
	app: App,
	settings: AudioRecorderSettings,
	filename: string,
	target: TFile,
): Promise<string> {
	const folder = settings.recordingsFolder;
	if (!folder) {
		return app.fileManager.getAvailablePathForAttachment(filename, target.path);
	}
	if (!app.vault.getFolderByPath(folder)) {
		await app.vault.createFolder(folder);
	}
	let path = normalizePath(`${folder}/${filename}`);
	for (let i = 1; app.vault.getAbstractFileByPath(path); i++) {
		path = normalizePath(`${folder}/${filename.replace(/(\.\w+)$/, ` ${i}$1`)}`);
	}
	return path;
}

async function insertEmbed(app: App, settings: AudioRecorderSettings, target: TFile, embed: string) {
	if (settings.insertPosition === 'cursor') {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file === target && view.getMode() === 'source') {
			view.editor.replaceSelection(embed + '\n');
			return;
		}
	}
	await app.vault.process(target, (data) => {
		const sep = data.length === 0 || data.endsWith('\n') ? '' : '\n';
		return `${data}${sep}\n${embed}\n`;
	});
}
