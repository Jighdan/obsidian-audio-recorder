import { App, PluginSettingTab, Setting } from 'obsidian';
import type AudioRecorderPlugin from './main';

export type Scope = 'all' | 'folder' | 'tag';
export type InsertPosition = 'cursor' | 'end';

export interface AudioRecorderSettings {
	/** Which notes show the floating button. */
	scope: Scope;
	/** Folder path used when scope is 'folder'. Subfolders are included. */
	folder: string;
	/** Tag without the leading '#', used when scope is 'tag'. Nested tags also match. */
	tag: string;
	/** Whether to add a record button to the left sidebar ribbon. */
	showRibbonIcon: boolean;
	/** Where recordings are saved. Empty = use Obsidian's attachment location. */
	recordingsFolder: string;
	/** Where the embed link is inserted in the note. */
	insertPosition: InsertPosition;
}

export const DEFAULT_SETTINGS: AudioRecorderSettings = {
	scope: 'all',
	folder: '',
	tag: '',
	showRibbonIcon: true,
	recordingsFolder: '',
	insertPosition: 'end',
};

/** Merge saved data with defaults. */
export function loadSettings(data: unknown): AudioRecorderSettings {
	return Object.assign({}, DEFAULT_SETTINGS, data as Partial<AudioRecorderSettings> | null);
}

const trimSlashes = (path: string) => path.trim().replace(/^\/+|\/+$/g, '');

export class AudioRecorderSettingTab extends PluginSettingTab {
	plugin: AudioRecorderPlugin;

	constructor(app: App, plugin: AudioRecorderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		containerEl.empty();

		new Setting(containerEl).setName('Button').setHeading();

		new Setting(containerEl)
			.setName('Show the button on')
			.setDesc('Which notes show the floating record button.')
			.addDropdown((dd) =>
				dd
					.addOption('all', 'All notes')
					.addOption('folder', 'Notes in a folder')
					.addOption('tag', 'Notes with a tag')
					.setValue(settings.scope)
					.onChange(async (value) => {
						settings.scope = value as Scope;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (settings.scope === 'folder') {
			new Setting(containerEl)
				.setName('Folder')
				.setDesc('Subfolders are included.')
				.addText((text) =>
					text
						.setPlaceholder('Meetings')
						.setValue(settings.folder)
						.onChange(async (value) => {
							settings.folder = trimSlashes(value);
							await this.plugin.saveSettings();
						}),
				);
		}

		if (settings.scope === 'tag') {
			new Setting(containerEl)
				.setName('Tag')
				.setDesc('With or without "#". Nested tags also match.')
				.addText((text) =>
					text
						.setPlaceholder('Meeting')
						.setValue(settings.tag)
						.onChange(async (value) => {
							settings.tag = value.trim().replace(/^#/, '');
							await this.plugin.saveSettings();
						}),
				);
		}

		new Setting(containerEl)
			.setName('Show in the left sidebar')
			.setDesc('Add a record button to the ribbon. It starts and stops recording for the open note.')
			.addToggle((toggle) =>
				toggle.setValue(settings.showRibbonIcon).onChange(async (value) => {
					settings.showRibbonIcon = value;
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
					.setValue(settings.recordingsFolder)
					.onChange(async (value) => {
						settings.recordingsFolder = trimSlashes(value);
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
					.setValue(settings.insertPosition)
					.onChange(async (value) => {
						settings.insertPosition = value as InsertPosition;
						await this.plugin.saveSettings();
					}),
			);
	}
}
