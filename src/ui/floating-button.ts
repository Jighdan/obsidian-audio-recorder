import { setIcon, setTooltip } from 'obsidian';
import type { RecorderState } from '../recorder';

export interface FloatingButtonHandlers {
	onStart: () => void;
	onPauseToggle: () => void;
	onStop: () => void;
	onDiscard: () => void;
}

export function formatElapsed(ms: number): string {
	const total = Math.floor(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Small floating control in the bottom-right corner.
 * Idle: a single faded mic button. Active: a compact pill with timer, pause and stop.
 */
export class FloatingButton {
	private el: HTMLElement;
	private micBtn: HTMLButtonElement;
	private pill: HTMLElement;
	private dot: HTMLElement;
	private timeEl: HTMLElement;
	private pauseBtn: HTMLButtonElement;

	constructor(parent: HTMLElement, handlers: FloatingButtonHandlers) {
		this.el = parent.createDiv({ cls: 'audio-button-container' });

		this.micBtn = this.el.createEl('button', { cls: 'audio-button-mic clickable-icon' });
		setIcon(this.micBtn, 'mic');
		setTooltip(this.micBtn, 'Start recording', { placement: 'left' });
		this.micBtn.addEventListener('click', handlers.onStart);

		this.pill = this.el.createDiv({ cls: 'audio-button-pill' });
		this.dot = this.pill.createSpan({ cls: 'audio-button-dot' });
		this.timeEl = this.pill.createSpan({ cls: 'audio-button-time', text: '00:00' });

		this.pauseBtn = this.pill.createEl('button', { cls: 'clickable-icon' });
		this.pauseBtn.addEventListener('click', handlers.onPauseToggle);

		const stopBtn = this.pill.createEl('button', { cls: 'clickable-icon' });
		setIcon(stopBtn, 'square');
		setTooltip(stopBtn, 'Stop and save', { placement: 'top' });
		stopBtn.addEventListener('click', handlers.onStop);

		const discardBtn = this.pill.createEl('button', { cls: 'clickable-icon' });
		setIcon(discardBtn, 'x');
		setTooltip(discardBtn, 'Discard recording', { placement: 'top' });
		discardBtn.addEventListener('click', handlers.onDiscard);

		this.setState('idle');
		this.setVisible(false);
	}

	setVisible(visible: boolean): void {
		this.el.toggleClass('is-hidden', !visible);
	}

	setState(state: RecorderState): void {
		const active = state !== 'idle';
		this.micBtn.toggleClass('is-hidden', active);
		this.pill.toggleClass('is-hidden', !active);
		this.dot.toggleClass('is-paused', state === 'paused');
		setIcon(this.pauseBtn, state === 'paused' ? 'play' : 'pause');
		setTooltip(this.pauseBtn, state === 'paused' ? 'Resume' : 'Pause', { placement: 'top' });
		if (!active) this.setElapsed(0);
	}

	setElapsed(ms: number): void {
		this.timeEl.setText(formatElapsed(ms));
	}

	destroy(): void {
		this.el.remove();
	}
}
