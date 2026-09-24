import { setIcon, setTooltip } from 'obsidian';
import type { RecorderState } from '../recorder';

export interface FloatingButtonHandlers {
	onStart: () => void;
	/** Reopen the recorder dialog from the minimised pill. */
	onExpand: () => void;
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
 * Idle: a single faded mic button. While a recording runs with its dialog
 * minimised: a pill with the recording dot and timer that reopens the dialog.
 */
export class FloatingButton {
	private el: HTMLElement;
	private micBtn: HTMLButtonElement;
	private pill: HTMLButtonElement;
	private dot: HTMLElement;
	private timeEl: HTMLElement;

	constructor(parent: HTMLElement, handlers: FloatingButtonHandlers) {
		this.el = parent.createDiv({ cls: 'audio-recorder-container' });

		this.micBtn = this.el.createEl('button', { cls: 'audio-recorder-mic clickable-icon' });
		setIcon(this.micBtn, 'mic');
		setTooltip(this.micBtn, 'Start recording', { placement: 'left' });
		this.micBtn.addEventListener('click', handlers.onStart);

		this.pill = this.el.createEl('button', { cls: 'audio-recorder-pill' });
		setTooltip(this.pill, 'Show recorder', { placement: 'top' });
		this.pill.addEventListener('click', handlers.onExpand);
		this.dot = this.pill.createSpan({ cls: 'audio-recorder-dot' });
		this.timeEl = this.pill.createSpan({ cls: 'audio-recorder-time', text: '00:00' });
		setIcon(this.pill.createSpan({ cls: 'audio-recorder-expand' }), 'chevron-up');

		this.setState('idle', false);
		this.setVisible(false);
	}

	setVisible(visible: boolean): void {
		this.el.toggleClass('is-hidden', !visible);
	}

	/** `expanded`: the recorder dialog is open, so the pill steps aside. */
	setState(state: RecorderState, expanded: boolean): void {
		const active = state !== 'idle';
		this.micBtn.toggleClass('is-hidden', active);
		this.pill.toggleClass('is-hidden', !active || expanded);
		this.dot.toggleClass('is-paused', state === 'paused');
		if (!active) this.setElapsed(0);
	}

	setElapsed(ms: number): void {
		this.timeEl.setText(formatElapsed(ms));
	}

	destroy(): void {
		this.el.remove();
	}
}
