import type { PlayerId } from "../../../shared/src/index.ts";
import { DisabledSpeechPort, type SpeechListenRequest, type SpeechPort, type SpeechStatus } from "./SpeechPort.ts";

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionErrorEvent = {
  error: string;
  message?: string;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export class BrowserSpeechPort implements SpeechPort {
  private readonly synthesis: SpeechSynthesis | null;
  private readonly Recognition: SpeechRecognitionConstructor | null;
  private readonly listeners = new Set<(status: SpeechStatus) => void>();
  private recognition: BrowserSpeechRecognition | null = null;
  private activeRequest: SpeechListenRequest | null = null;
  private isListening = false;
  private isSpeaking = false;
  private isStarting = false;

  public constructor(windowObject: Window = window) {
    this.synthesis = "speechSynthesis" in windowObject ? windowObject.speechSynthesis : null;
    this.Recognition = windowObject.SpeechRecognition ?? windowObject.webkitSpeechRecognition ?? null;
  }

  public getStatus(): SpeechStatus {
    return {
      isRecognitionAvailable: Boolean(this.Recognition),
      isSynthesisAvailable: Boolean(this.synthesis),
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      activePlayerId: this.activeRequest?.playerId ?? null
    };
  }

  public subscribe(listener: (status: SpeechStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async startListening(request: SpeechListenRequest): Promise<void> {
    if (!this.Recognition) {
      request.onError("Speech recognition is unavailable in this browser.");
      this.emit();
      return;
    }

    this.activeRequest = request;
    this.emit();

    if (this.isSpeaking) {
      return;
    }

    this.startRecognition();
  }

  public async stopListening(playerId?: PlayerId): Promise<void> {
    if (playerId && this.activeRequest?.playerId !== playerId) {
      return;
    }

    this.activeRequest = null;
    this.stopRecognition();
    this.emit();
  }

  public async speak(text: string): Promise<void> {
    if (!this.synthesis || !text.trim()) {
      return;
    }

    const shouldResumeAfterSpeech = Boolean(this.activeRequest);
    this.stopRecognition();
    this.synthesis.cancel();
    this.isSpeaking = true;
    this.emit();

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      this.synthesis?.speak(utterance);
    });

    this.isSpeaking = false;
    this.emit();

    if (shouldResumeAfterSpeech && this.activeRequest) {
      this.startRecognition();
    }
  }

  public cancelSpeaking(): void {
    this.synthesis?.cancel();
    this.isSpeaking = false;
    this.emit();
  }

  private startRecognition(): void {
    if (!this.Recognition || !this.activeRequest || this.isListening || this.isStarting || this.isSpeaking) {
      return;
    }

    this.isStarting = true;
    const recognition = new this.Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => this.handleResult(event);
    recognition.onerror = (event) => this.handleError(event);
    recognition.onend = () => this.handleEnd();
    this.recognition = recognition;

    try {
      recognition.start();
      this.isListening = true;
    } catch {
      this.activeRequest?.onError("Could not start speech recognition.");
      this.activeRequest = null;
      this.recognition = null;
      this.isListening = false;
    } finally {
      this.isStarting = false;
      this.emit();
    }
  }

  private stopRecognition(): void {
    if (!this.recognition) {
      this.isListening = false;
      return;
    }

    try {
      this.recognition.stop();
    } catch {
      try {
        this.recognition.abort();
      } catch {}
    }

    this.recognition = null;
    this.isListening = false;
  }

  private handleResult(event: RecognitionEvent): void {
    if (!this.activeRequest) {
      return;
    }

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result?.isFinal) {
        continue;
      }

      const transcript = result[0]?.transcript.trim();
      if (!transcript) {
        continue;
      }

      const request = this.activeRequest;
      this.activeRequest = null;
      this.stopRecognition();
      request.onResult(transcript, request.playerId);
      this.emit();
      return;
    }
  }

  private handleError(event: RecognitionErrorEvent): void {
    const request = this.activeRequest;
    this.activeRequest = null;
    this.stopRecognition();
    request?.onError(speechErrorMessage(event));
    this.emit();
  }

  private handleEnd(): void {
    this.recognition = null;
    this.isListening = false;
    this.emit();

    if (this.activeRequest && !this.isSpeaking) {
      this.startRecognition();
    }
  }

  private emit(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  }
}

export function createSpeechPort(): SpeechPort {
  if (typeof window === "undefined") {
    return new DisabledSpeechPort();
  }

  return new BrowserSpeechPort(window);
}

function speechErrorMessage(event: RecognitionErrorEvent): string {
  if (event.error === "not-allowed" || event.error === "service-not-allowed") {
    return "Microphone permission is blocked. Allow mic access in the browser, then enable hands-free again.";
  }

  if (event.error === "no-speech") {
    return "No speech heard.";
  }

  return event.message || `Speech recognition error: ${event.error}`;
}
