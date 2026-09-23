export type RecorderState = 'idle' | 'recording' | 'paused';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function pickMimeType(): string {
	for (const type of MIME_CANDIDATES) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return '';
}

export function extensionFor(mimeType: string): string {
	if (mimeType.includes('mp4')) return 'm4a';
	if (mimeType.includes('ogg')) return 'ogg';
	return 'webm';
}

export interface Recording {
	blob: Blob;
	mimeType: string;
	durationMs: number;
}

/** Thin wrapper around MediaRecorder that tracks elapsed time across pauses. */
export class AudioRecorder {
	private recorder: MediaRecorder | null = null;
	private stream: MediaStream | null = null;
	private chunks: Blob[] = [];
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private samples: Float32Array<ArrayBuffer> | null = null;
	private accumulatedMs = 0;
	private segmentStart = 0;

	get state(): RecorderState {
		if (!this.recorder || this.recorder.state === 'inactive') return 'idle';
		return this.recorder.state === 'paused' ? 'paused' : 'recording';
	}

	get elapsedMs(): number {
		return this.state === 'recording'
			? this.accumulatedMs + (performance.now() - this.segmentStart)
			: this.accumulatedMs;
	}

	/** Current input loudness from 0 (silence) to 1, for the level meter. */
	get level(): number {
		if (!this.analyser || !this.samples) return 0;
		this.analyser.getFloatTimeDomainData(this.samples);
		let sum = 0;
		for (const s of this.samples) sum += s * s;
		const rms = Math.sqrt(sum / this.samples.length);
		// Speech RMS rarely goes above ~0.3; scale so normal talking fills the meter.
		return Math.min(1, rms * 4);
	}

	async start(): Promise<void> {
		if (this.state !== 'idle') return;
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const mimeType = pickMimeType();
		this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
		this.chunks = [];
		this.accumulatedMs = 0;
		this.recorder.addEventListener('dataavailable', (e) => {
			if (e.data.size > 0) this.chunks.push(e.data);
		});
		this.startMeter(this.stream);
		this.recorder.start(1000);
		this.segmentStart = performance.now();
	}

	pause(): void {
		if (this.state !== 'recording' || !this.recorder) return;
		this.recorder.pause();
		this.accumulatedMs += performance.now() - this.segmentStart;
	}

	resume(): void {
		if (this.state !== 'paused' || !this.recorder) return;
		this.recorder.resume();
		this.segmentStart = performance.now();
	}

	/** Stops recording and resolves with the captured audio. */
	stop(): Promise<Recording | null> {
		const recorder = this.recorder;
		if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
		const durationMs = this.elapsedMs;
		return new Promise((resolve) => {
			recorder.addEventListener(
				'stop',
				() => {
					const mimeType = recorder.mimeType || 'audio/webm';
					const blob = new Blob(this.chunks, { type: mimeType });
					this.cleanup();
					resolve({ blob, mimeType, durationMs });
				},
				{ once: true },
			);
			recorder.stop();
		});
	}

	/** Stops recording and throws the audio away. */
	discard(): void {
		if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
		this.cleanup();
	}

	private startMeter(stream: MediaStream): void {
		try {
			this.audioContext = new AudioContext();
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 1024;
			this.audioContext.createMediaStreamSource(stream).connect(this.analyser);
			this.samples = new Float32Array(this.analyser.fftSize);
		} catch (err) {
			// The meter is cosmetic; recording works without it.
			console.warn('Audio button: level meter unavailable', err);
		}
	}

	private cleanup(): void {
		void this.audioContext?.close();
		this.audioContext = null;
		this.analyser = null;
		this.samples = null;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		this.recorder = null;
		this.chunks = [];
		this.accumulatedMs = 0;
	}
}
