import { App, getAllTags, TFile } from 'obsidian';
import type { AudioButtonSettings } from './settings';

function inFolder(file: TFile, folders: string[]): boolean {
	return folders.some((folder) => folder === '' || file.path.startsWith(folder + '/'));
}

function hasTag(app: App, file: TFile, tags: string[]): boolean {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return false;
	const noteTags = (getAllTags(cache) ?? []).map((t) => t.replace(/^#/, '').toLowerCase());
	return tags.some((wanted) => {
		const w = wanted.toLowerCase();
		return noteTags.some((t) => t === w || t.startsWith(w + '/'));
	});
}

/** Whether the floating record button should be shown for this note. */
export function matchesFile(app: App, file: TFile | null, settings: AudioButtonSettings): boolean {
	if (!file || file.extension !== 'md') return false;

	const { folders, tags, matchMode } = settings;
	const hasFolderRule = folders.length > 0;
	const hasTagRule = tags.length > 0;

	if (!hasFolderRule && !hasTagRule) return true;
	if (hasFolderRule && !hasTagRule) return inFolder(file, folders);
	if (!hasFolderRule && hasTagRule) return hasTag(app, file, tags);

	return matchMode === 'all'
		? inFolder(file, folders) && hasTag(app, file, tags)
		: inFolder(file, folders) || hasTag(app, file, tags);
}
