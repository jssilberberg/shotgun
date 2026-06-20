// Single entry point for game audio cues, with a global mute (per AGENTS.md).
//
// No audio assets ship yet, so cues are synthesized with the Web Audio API.
// This keeps the feature audible and asset-free; when real cues are added to
// `/public/audio/<name>.mp3`, swap `playCue` to prefer the loaded asset and
// fall back to the tone for anything missing.

export type CueName =
  | "onBuzz"
  | "onSteal"
  | "onCorrect"
  | "onWrong"
  | "onWin"
  | "onTurnChange"
  | "idleBed";

type Tone = { freq: number; start: number; duration: number; type?: OscillatorType };

// Short, distinct signatures so each cue is recognizable by ear alone (car use).
const CUE_TONES: Record<Exclude<CueName, "idleBed">, Tone[]> = {
  onCorrect: [
    { freq: 660, start: 0, duration: 0.12 },
    { freq: 880, start: 0.1, duration: 0.2 }
  ],
  onWrong: [{ freq: 180, start: 0, duration: 0.3, type: "sawtooth" }],
  onSteal: [
    { freq: 520, start: 0, duration: 0.1, type: "square" },
    { freq: 520, start: 0.15, duration: 0.13, type: "square" }
  ],
  onTurnChange: [{ freq: 440, start: 0, duration: 0.14 }],
  onWin: [
    { freq: 523, start: 0, duration: 0.14 },
    { freq: 659, start: 0.13, duration: 0.14 },
    { freq: 784, start: 0.26, duration: 0.28 }
  ],
  onBuzz: [{ freq: 300, start: 0, duration: 0.18, type: "square" }]
};

let muted = false;
let audioContext: AudioContext | null = null;

export function setCueMuted(value: boolean): void {
  muted = value;
}

export function isCueMuted(): boolean {
  return muted;
}

export function playCue(name: CueName): void {
  if (muted || name === "idleBed") {
    return;
  }

  const context = getContext();
  if (!context) {
    return;
  }

  // Browsers start the context suspended until a user gesture; cues fire after
  // taps/answers, so a best-effort resume is enough.
  void context.resume().catch(() => {});

  const now = context.currentTime;
  for (const tone of CUE_TONES[name]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.value = tone.freq;

    const startAt = now + tone.start;
    const endAt = startAt + tone.duration;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new Ctor();
  }

  return audioContext;
}
