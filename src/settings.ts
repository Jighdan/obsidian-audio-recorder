import { App, PluginSettingTab, Setting } from 'obsidian';
import type AudioButtonPlugin from './main';

export type MatchMode = 'any' | 'all';
export type InsertPosition = 'cursor' | 'end';

export interface AudioButtonSettings {
	/** Folder paths; a note matches if it lives in one of them (recursively). */
	folders: string[];
	/** Tags without the leading '#'; nested tags (tag/child) also match. */
	tags: string[];
	/** When both folders and tags are set: match either rule, or require both. */
	matchMode: MatchMode;
	/** Where recordings are saved. Empty = use Obsidian's attachment location. */
	recordingsFolder: string;
	/** Where the embed link is inserted in the note. */
	insertPosition: InsertPosition;
}

export const DEFAULT_SETTINGS: AudioButtonSettings = {
	folders: [],
	tags: [],
	matchMode: 'any',
	recordingsFolder: '',
	insertPosition: 'end',
};

function parseList(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export class AudioButtonSettingTab extends PluginSettingTab {
	plugin: AudioButtonPlugin;

	constructor(app: App, plugin: AudioButtonPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Which notes show the button').setHeading();

		new Setting(containerEl)
			.setName('Folders')
			.setDesc(
				'One per line or comma-separated. Subfolders are included. Leave folders and tags empty to show the button on every note.',
			)
			.addTextArea((text) =>
				text
					.setPlaceholder('Meetings')
					.setValue(this.plugin.settings.folders.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.folders = parseList(value).map((f) =>
							f.replace(/^\/+|\/+$/g, ''),
						);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Tags')
			.setDesc('One per line or comma-separated, with or without "#". Nested tags also match.')
			.addTextArea((text) =>
				text
					.setPlaceholder('#meeting')
					.setValue(this.plugin.settings.tags.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.tags = parseList(value).map((t) => t.replace(/^#/, ''));
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Match mode')
			.setDesc('Used when both folders and tags are set.')
			.addDropdown((dd) =>
				dd
					.addOption('any', 'In a folder or has a tag')
					.addOption('all', 'In a folder and has a tag')
					.setValue(this.plugin.settings.matchMode)
					.onChange(async (value) => {
						this.plugin.settings.matchMode = value as MatchMode;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Recordings').setHeading();

		new Setting(containerEl)
			.setName('Recordings folder')
			.setDesc("Leave empty to use Obsidian's attachment location.")
			.addText((text) =>
				text
					.setPlaceholder('Recordings')
					.setValue(this.plugin.settings.recordingsFolder)
					.onChange(async (value) => {
						this.plugin.settings.recordingsFolder = value.trim().replace(/^\/+|\/+$/g, '');
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Insert recording')
			.setDesc('Where the embed is added in the note when a recording is saved.')
			.addDropdown((dd) =>
				dd
					.addOption('end', 'At the end of the note')
					.addOption('cursor', 'At the editing position (if the note is open)')
					.setValue(this.plugin.settings.insertPosition)
					.onChange(async (value) => {
						this.plugin.settings.insertPosition = value as InsertPosition;
						await this.plugin.saveSettings();
					}),
			);
	}
}
