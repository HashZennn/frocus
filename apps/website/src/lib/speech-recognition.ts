interface SpeechRecognitionAlternativeLike {
	transcript: string;
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternativeLike> {
	isFinal: boolean;
}

interface SpeechRecognitionEventLike {
	results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEventLike) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
	abort: () => void;
}

interface WindowWithSpeechRecognition extends Window {
	SpeechRecognition?: new () => SpeechRecognitionLike;
	webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

export interface SpeechRecognitionSession {
	start: () => boolean;
	stop: () => Promise<string>;
	abort: () => void;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
	if (typeof window === "undefined") {
		return null;
	}

	const browserWindow = window as WindowWithSpeechRecognition;

	return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

export function createSpeechRecognitionSession(languageCode: string): SpeechRecognitionSession | null {
	const SpeechRecognition = getSpeechRecognitionConstructor();

	if (!SpeechRecognition) {
		return null;
	}

	const recognition = new SpeechRecognition();
	let transcript = "";
	let started = false;
	let stopResolve: ((value: string) => void) | null = null;
	let stopPromise: Promise<string> | null = null;

	const finalize = () => {
		started = false;

		if (stopResolve) {
			stopResolve(transcript.trim());
			stopResolve = null;
			stopPromise = null;
		}
	};

	recognition.continuous = true;
	recognition.interimResults = true;
	recognition.lang = languageCode;
	recognition.onresult = (event) => {
		transcript = Array.from(event.results)
			.map((result) => result[0]?.transcript ?? "")
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
	};
	recognition.onerror = () => {
		finalize();
	};
	recognition.onend = () => {
		finalize();
	};

	return {
		start() {
			if (started) {
				return false;
			}

			transcript = "";
			started = true;

			try {
				recognition.start();
				return true;
			} catch {
				started = false;
				transcript = "";
				return false;
			}
		},
		stop() {
			if (!started) {
				return Promise.resolve(transcript.trim());
			}

			if (!stopPromise) {
				stopPromise = new Promise<string>((resolve) => {
					stopResolve = resolve;
				});
			}

			try {
				recognition.stop();
			} catch {
				finalize();
			}

			return stopPromise;
		},
		abort() {
			started = false;

			try {
				recognition.abort();
			} catch {
				// Ignore browser-specific abort errors.
			}

			finalize();
		},
	};
}