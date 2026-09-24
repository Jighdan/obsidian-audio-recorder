import { App, getAllTags, TFile } from 'obsidian';
import type { AudioRecorderSettings } from './settings';

function inFolder(file: TFile, folder: string): boolean {
	return folder === '' || file.path.startsWith(folder + '/');
}

function hasTag(app: App, file: TFile, tag: string): boolean {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return false;
	const wanted = tag.toLowerCase();
	return (getAllTags(cache) ?? []).some((t) => {
		const noteTag = t.replace(/^#/, '').toLowerCase();
		return noteTag === wanted || noteTag.startsWith(wanted + '/');
	});
}

/** Whether the floating record button should be shown for this note. */
export function matchesFile(app: App, file: TFile | null, settings: AudioRecorderSettings): boolean {
	if (!file || file.extension !== 'md') return false;

	switch (settings.scope) {
		case 'folder':
			return inFolder(file, settings.folder);
		case 'tag':
			// An empty tag matches nothing rather than everything.
			return settings.tag !== '' && hasTag(app, file, settings.tag);
		default:
			return true;
	}
}
