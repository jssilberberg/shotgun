import type { PlayerId } from "../../../shared/src/index.ts";

export interface SpeechListenRequest {
  playerId: PlayerId;
  onResult(transcript: string, playerId: PlayerId): void;
  onError(message: string): void;
}

export interface SpeechStatus {
  isRecognitionAvailable: boolean;
  isSynthesisAvailable: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  activePlayerId: PlayerId | null;
}

export interface SpeechPort {
  getStatus(): SpeechStatus;
  subscribe(listener: (status: SpeechStatus) => void): () => void;
  startListening(request: SpeechListenRequest): Promise<void>;
  stopListening(playerId?: PlayerId): Promise<void>;
  speak(text: string): Promise<void>;
  cancelSpeaking(): void;
}

export class DisabledSpeechPort implements SpeechPort {
  public getStatus(): SpeechStatus {
    return {
      isRecognitionAvailable: false,
      isSynthesisAvailable: false,
      isListening: false,
      isSpeaking: false,
      activePlayerId: null
    };
  }

  public subscribe(_listener: (status: SpeechStatus) => void): () => void {
    return () => {};
  }

  public async startListening(_request: SpeechListenRequest): Promise<void> {}

  public async stopListening(_playerId?: PlayerId): Promise<void> {}

  public async speak(_text: string): Promise<void> {}

  public cancelSpeaking(): void {}
}
