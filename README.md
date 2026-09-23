# Audio Button

A small floating button in the bottom-right corner for recording voice notes in Obsidian.

- The button only appears on notes that match your rules (folders and/or tags, configurable in **Settings → Audio Button**). With no rules, it appears on every note.
- Select the mic to start recording. While recording, it shows a timer plus **Pause/Resume**, **Stop** (save) and **Discard**.
- On stop, the audio is saved to your attachment folder (or a custom folder) and embedded in the note you started recording from.
- Commands: **Start/stop recording**, **Pause/resume recording** (bind them to hotkeys).

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # production build
```

Copy `main.js`, `manifest.json` and `styles.css` to `<Vault>/.obsidian/plugins/audio-button/`, reload Obsidian and enable the plugin.
