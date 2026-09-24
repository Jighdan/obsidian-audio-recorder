# Minimalist Audio Recorder

A small floating button in the bottom-right corner for recording voice notes in Obsidian.

- Choose where the button appears in **Settings → Minimalist Audio Recorder**: on all notes, only on notes in a folder, or only on notes with a tag.
- Optionally add a mic icon to the left sidebar that starts and stops recording for the open note.
- Select the mic to start recording. While recording, it shows a timer plus **Pause/Resume**, **Stop** (save) and **Discard**.
- On stop, the audio is saved to your attachment folder (or a custom folder) and embedded in the note you started recording from.
- Commands (no hotkeys by default; assign your own in **Settings → Hotkeys**): **Start recording**, **Pause recording**, **Resume recording**, **Stop and save recording**, **Start/stop recording**, **Pause/resume recording** and **Start/pause/resume recording**.

## Development

```bash
pnpm install
pnpm dev     # watch build
pnpm build   # production build
```

`pnpm install` also sets up git hooks: ESLint runs on staged files before each commit, and commit messages must follow [Conventional Commits](https://www.conventionalcommits.org).

To build straight into a vault, create a `.env` file with:

```
OBSIDIAN_PLUGIN_DIR=/path/to/Vault/.obsidian/plugins/minimalist-audio-recorder
```

Every build then copies `main.js`, `manifest.json` and `styles.css` there, plus a `.hotreload` marker so the [Hot Reload](https://github.com/pjeby/hot-reload) plugin reloads it automatically.
