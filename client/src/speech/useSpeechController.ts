import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameEvent, PlayerId } from "../../../shared/src/index.ts";
import { createSpeechPort } from "./browserSpeech.ts";
import type { SpeechPort, SpeechStatus } from "./SpeechPort.ts";

export interface SpeechController {
  status: SpeechStatus;
  isHandsFreeEnabled: boolean;
  enableHandsFree(): void;
  disableHandsFree(): void;
  startPushToTalk(playerId: PlayerId): void;
  stopPushToTalk(playerId: PlayerId): void;
}

const DEFAULT_STATUS: SpeechStatus = {
  isRecognitionAvailable: false,
  isSynthesisAvailable: false,
  isListening: false,
  isSpeaking: false,
  activePlayerId: null
};

export function useSpeechController({
  spokenText,
  activePlayerId,
  canListen,
  canPass,
  emit,
  setError
}: {
  spokenText: string | null;
  activePlayerId: PlayerId | null;
  canListen: boolean;
  canPass: boolean;
  emit(event: GameEvent): Promise<void>;
  setError(message: string | null): void;
}): SpeechController {
  const port = useMemo<SpeechPort>(() => createSpeechPort(), []);
  const [status, setStatus] = useState<SpeechStatus>(() => port.getStatus?.() ?? DEFAULT_STATUS);
  const [isHandsFreeEnabled, setIsHandsFreeEnabled] = useState(true);
  const lastSpokenText = useRef<string | null>(null);
  const emitRef = useRef(emit);
  const setErrorRef = useRef(setError);
  const handsFreeRef = useRef(true);
  const canPassRef = useRef(canPass);
  const noSpeechRef = useRef<{ playerId: PlayerId; count: number } | null>(null);

  useEffect(() => {
    emitRef.current = emit;
    setErrorRef.current = setError;
  }, [emit, setError]);

  useEffect(() => {
    handsFreeRef.current = isHandsFreeEnabled;
  }, [isHandsFreeEnabled]);

  useEffect(() => {
    canPassRef.current = canPass;
  }, [canPass]);

  // A new player on the clock resets the re-prompt counter.
  useEffect(() => {
    noSpeechRef.current = null;
  }, [activePlayerId]);

  useEffect(() => {
    return port.subscribe(setStatus);
  }, [port]);

  // §7: re-prompt the same player once on silence, then treat it as a pass.
  const handleNoSpeech = useCallback((playerId: PlayerId) => {
    if (!canPassRef.current) {
      // Not an answering phase (e.g. the resolved screen) — just keep listening
      // for a "next"/"reveal" command; the auto-listen effect re-opens the mic.
      return;
    }

    const previous = noSpeechRef.current;
    const count = previous && previous.playerId === playerId ? previous.count + 1 : 1;
    if (count >= 2) {
      noSpeechRef.current = null;
      void emitRef.current({ type: "pass", playerId });
      return;
    }

    noSpeechRef.current = { playerId, count };
    // First miss: the auto-listen effect re-opens the mic for the re-prompt.
  }, []);

  const startListeningFor = useCallback((playerId: PlayerId) => {
    void port.startListening({
      playerId,
      onResult(transcript, transcriptPlayerId) {
        noSpeechRef.current = null;
        const event = transcriptToEvent(transcript, transcriptPlayerId);
        void emitRef.current(event);
      },
      onError(message) {
        if (isPermissionBlocked(message)) {
          setErrorRef.current(message);
          setIsHandsFreeEnabled(false);
          return;
        }

        if (isNoSpeech(message) && handsFreeRef.current) {
          handleNoSpeech(playerId);
          return;
        }

        setErrorRef.current(message);
      }
    });
  }, [handleNoSpeech, port]);

  useEffect(() => {
    if (!spokenText || spokenText === lastSpokenText.current) {
      return;
    }

    lastSpokenText.current = spokenText;
    void port.speak(spokenText);
  }, [port, spokenText]);

  useEffect(() => {
    if (!isHandsFreeEnabled) {
      return;
    }

    if (!canListen || !activePlayerId || !status.isRecognitionAvailable) {
      if (status.activePlayerId) {
        void port.stopListening();
      }
      return;
    }

    if (status.activePlayerId && status.activePlayerId !== activePlayerId) {
      void port.stopListening();
      return;
    }

    if (status.isSpeaking || status.isListening || status.activePlayerId === activePlayerId) {
      return;
    }

    startListeningFor(activePlayerId);
  }, [
    activePlayerId,
    canListen,
    isHandsFreeEnabled,
    port,
    startListeningFor,
    status.activePlayerId,
    status.isListening,
    status.isRecognitionAvailable,
    status.isSpeaking
  ]);

  return {
    status,
    isHandsFreeEnabled,
    enableHandsFree() {
      if (!activePlayerId || !canListen) {
        return;
      }

      setIsHandsFreeEnabled(true);
      startListeningFor(activePlayerId);
    },
    disableHandsFree() {
      setIsHandsFreeEnabled(false);
      void port.stopListening();
    },
    startPushToTalk(playerId) {
      startListeningFor(playerId);
    },
    stopPushToTalk(playerId) {
      if (!isHandsFreeEnabled) {
        void port.stopListening(playerId);
      }
    }
  };
}

function isPermissionBlocked(message: string): boolean {
  const normalized = message.toLocaleLowerCase();
  return normalized.includes("permission") || normalized.includes("not-allowed") || normalized.includes("not allowed");
}

function isNoSpeech(message: string): boolean {
  return message.toLocaleLowerCase().includes("no speech");
}

function transcriptToEvent(transcript: string, playerId: PlayerId): GameEvent {
  const normalized = normalizeCommand(transcript);

  if (matchesCommand(normalized, ["pass", "skip"])) {
    return { type: "pass", playerId };
  }

  if (matchesCommand(normalized, ["reveal", "show answer", "show the answer"])) {
    return { type: "reveal" };
  }

  if (matchesCommand(normalized, ["next", "next question"])) {
    return { type: "nextQuestion" };
  }

  return {
    type: "submitAnswer",
    playerId,
    answer: transcript
  };
}

function normalizeCommand(transcript: string): string {
  return transcript.trim().toLocaleLowerCase().replace(/[.!?,]+$/g, "").trim();
}

// Match a command when the transcript is the phrase itself or the phrase followed
// by filler ("pass please", "next question", "skip it") — not merely contains it,
// so a spoken answer that happens to include the word isn't hijacked.
function matchesCommand(normalized: string, phrases: string[]): boolean {
  return phrases.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `));
}
