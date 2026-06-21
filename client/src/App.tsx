import { FastForward, Flag, Mic, MicOff, RotateCcw, Send, Trophy, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Difficulty, GameEvent, GamePhase, GameState, ManualAward, Player, PlayerId } from "../../shared/src/index.ts";
import { fetchGameState, sendGameEvent, startNewGame } from "./api/gameClient.ts";
import { type CueName, playCue, setCueMuted } from "./audio/playCue.ts";
import { useSpeechController } from "./speech/useSpeechController.ts";

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const [cuesMuted, setCuesMuted] = useState(false);
  const cueStateRef = useRef<{ questionNumber: number; phase: GamePhase; resolvedFor: number | null } | null>(null);

  useEffect(() => {
    void runApi(() => fetchGameState(), setState, setError, setIsBusy);
  }, []);

  useEffect(() => {
    if (state?.settings.difficulty) {
      setSelectedDifficulty(state.settings.difficulty);
    }
  }, [state?.settings.difficulty]);

  useEffect(() => {
    setCueMuted(cuesMuted);
  }, [cuesMuted]);

  // Fire audio cues on meaningful state transitions: steal opening, the question
  // outcome (correct/wrong), and advancing to a new question.
  useEffect(() => {
    if (!state) {
      return;
    }

    const prev = cueStateRef.current;
    const resolvedFor = state.resolution?.questionNumber ?? null;

    if (state.phase === "complete" && prev?.phase !== "complete") {
      playCue("onWin");
    } else if (state.phase === "steal" && prev?.phase !== "steal") {
      playCue("onSteal");
    } else if (state.phase === "resolved" && state.resolution && resolvedFor !== prev?.resolvedFor) {
      playCue(resolutionCue(state.resolution));
    } else if (prev && state.questionNumber !== prev.questionNumber) {
      playCue("onTurnChange");
    }

    cueStateRef.current = {
      questionNumber: state.questionNumber,
      phase: state.phase,
      resolvedFor: resolvedFor ?? prev?.resolvedFor ?? null
    };
  }, [state]);

  const activePlayer = useMemo(() => {
    if (!state) {
      return null;
    }
    return state.players.find((player) => player.id === state.onTheClockPlayerId) ?? null;
  }, [state]);
  const activePlayerName = activePlayer?.name ?? "";

  const hostText = state?.lastAction?.spokenText ?? state?.lastAction?.message ?? "Host ready.";

  const emit = useCallback(async (event: GameEvent) => {
    await runApi(() => sendGameEvent(event), setState, setError, setIsBusy);
  }, []);

  const speech = useSpeechController({
    spokenText: state?.lastAction?.spokenText ?? null,
    activePlayerId: state?.onTheClockPlayerId ?? null,
    // Keep listening once a question resolves so "next"/"reveal" work hands-free.
    // Spoken answers in the resolved phase are ignored server-side. The mic goes
    // off at game over (the closing banter still speaks).
    canListen: state !== null && state.phase !== "complete",
    // Silence only becomes a pass while a player is actually on the clock.
    canPass: state?.phase === "primary" || state?.phase === "steal",
    emit,
    setError
  });

  const isSpeakingRef = useRef(false);
  useEffect(() => {
    isSpeakingRef.current = speech.status.isSpeaking;
  }, [speech.status.isSpeaking]);

  // Auto-advance: once a question resolves (answered correctly, or both players
  // missed), let the host finish the reveal line, then move to the next question.
  // Skips the terminal "complete" phase. Cancels if the state changes first.
  useEffect(() => {
    if (!state || state.phase !== "resolved") {
      return;
    }

    let cancelled = false;
    let timer = window.setTimeout(function advanceWhenQuiet() {
      if (cancelled) {
        return;
      }
      if (isSpeakingRef.current) {
        timer = window.setTimeout(advanceWhenQuiet, 300);
        return;
      }
      void emit({ type: "nextQuestion" });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state?.phase, state?.resolution?.questionNumber, emit]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state || !answer.trim()) {
      return;
    }

    const answerText = answer.trim();
    setAnswer("");
    await emit({
      type: "submitAnswer",
      playerId: state.onTheClockPlayerId,
      answer: answerText
    });
  }

  async function handlePass() {
    if (!state) {
      return;
    }

    await emit({
      type: "pass",
      playerId: state.onTheClockPlayerId
    });
  }

  async function handleOverride(award: ManualAward) {
    await emit({ type: "manualOverride", award });
  }

  async function handleNewGame() {
    await runApi(() => startNewGame(selectedDifficulty), setState, setError, setIsBusy);
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-night px-4 py-5 text-headlight sm:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
          <p className="text-lg font-semibold">Loading game...</p>
        </div>
      </main>
    );
  }

  // Overrides correct the just-resolved question (PRD §5.4); disable them mid-question
  // so a stray tap can't hand out points while an answer is still live.
  const isResolved = state.phase === "resolved";
  const isComplete = state.phase === "complete";
  const winnerId = isComplete ? winningPlayerId(state.players) : null;
  const inputsLocked = isBusy || isResolved || isComplete;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-night px-3 pb-[24rem] pt-3 text-headlight sm:px-6 sm:pb-6 sm:pt-5">
      <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-3 sm:gap-5">
        <header className="grid grid-cols-[auto_1fr] items-center gap-2 sm:grid-cols-[auto_1fr_auto] sm:gap-3">
          <img className="h-9 w-auto sm:order-1 sm:h-12" src="/brand/lockup.svg" alt="Shotgun" />
          <div className="order-3 col-span-2 sm:order-2 sm:col-span-1">
            <DifficultySelector
              value={selectedDifficulty}
              disabled={isBusy}
              onChange={setSelectedDifficulty}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 sm:order-3">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-card border border-headlight/30 bg-ink/60 px-3 py-2 text-headlight transition hover:border-headlight/70 sm:min-h-12"
              type="button"
              aria-pressed={cuesMuted}
              aria-label={cuesMuted ? "Unmute sound effects" : "Mute sound effects"}
              title={cuesMuted ? "Sound effects off" : "Sound effects on"}
              onClick={() => setCuesMuted((muted) => !muted)}
            >
              {cuesMuted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-headlight/30 bg-ink/60 px-3 py-2 text-sm font-bold text-headlight transition hover:border-headlight/70 disabled:opacity-60 sm:min-h-12 sm:px-4"
              type="button"
              disabled={isBusy}
              onClick={handleNewGame}
            >
              <RotateCcw size={18} aria-hidden="true" />
              <span>New</span>
            </button>
          </div>
        </header>

        <section className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:gap-4" aria-label="Scoreboard">
          {state.players.map((player) => (
            <ScoreCard
              key={player.id}
              player={player}
              isActive={!isComplete && player.id === state.onTheClockPlayerId}
              isSteal={state.phase === "steal" && player.id === state.onTheClockPlayerId}
              isWinner={isComplete && (winnerId === "tie" || winnerId === player.id)}
            />
          ))}
        </section>

        <section className="min-w-0 rounded-card border border-headlight/20 bg-ink/70 p-3 shadow-2xl shadow-ink/40 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-headlight/70 sm:text-sm">
                <span>Q{state.questionNumber}</span>
                <span>{state.currentQuestion.category}</span>
                <DifficultyBadge difficulty={state.settings.difficulty} />
              </div>
              <h1 className="mt-1 text-xl font-extrabold leading-tight text-headlight sm:text-3xl">
                {isComplete
                  ? winnerId === "tie"
                    ? "Final — it's a tie"
                    : `Final — ${state.players.find((player) => player.id === winnerId)?.name ?? ""} wins`
                  : activePlayerName
                    ? `${activePlayerName} on the clock`
                    : "On the clock"}
              </h1>
            </div>
            <PhaseBadge phase={state.phase} />
          </div>

          <div className="border-t border-headlight/15 pt-3">
            <p className="line-clamp-2 break-words text-sm font-bold leading-snug text-headlight/85 sm:text-xl sm:leading-relaxed">
              {hostText}
            </p>
            <details className="mt-2 text-xs font-semibold text-headlight/55 sm:text-sm">
              <summary className="cursor-pointer list-none truncate text-headlight/60">Question text</summary>
              <p className="mt-1 line-clamp-2 break-words leading-snug">{state.currentQuestion.prompt}</p>
            </details>
          </div>
        </section>

        <section className="fixed inset-x-0 bottom-0 z-20 grid gap-3 border-t border-headlight/20 bg-ink/95 p-3 pb-safe shadow-2xl shadow-ink sm:static sm:rounded-card sm:border sm:bg-ink/55 sm:p-4">
          <HandsFreeButton
            activePlayerName={activePlayerName}
            disabled={inputsLocked}
            isAvailable={speech.status.isRecognitionAvailable}
            isEnabled={speech.isHandsFreeEnabled}
            isListening={speech.status.isListening}
            isSpeaking={speech.status.isSpeaking}
            onEnable={speech.enableHandsFree}
            onDisable={speech.disableHandsFree}
          />

          <form className="grid grid-cols-[1fr_auto] gap-2 sm:gap-3" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="answer">Typed answer</label>
            <input
              id="answer"
              className="min-h-11 min-w-0 rounded-card border border-headlight/20 bg-night px-3 text-sm font-semibold text-headlight outline-none transition placeholder:text-headlight/40 focus:border-indigo focus:ring-4 focus:ring-indigo/30 sm:min-h-14 sm:px-4 sm:text-lg"
              value={answer}
              placeholder={`Backup typed answer as ${activePlayerName}`}
              disabled={inputsLocked}
              onChange={(event) => setAnswer(event.target.value)}
            />
            <button
              className="inline-flex min-h-11 min-w-14 items-center justify-center gap-2 rounded-card bg-indigo px-4 py-3 text-sm font-extrabold text-headlight shadow-lg shadow-indigo/25 transition hover:brightness-110 disabled:opacity-60 sm:min-h-14 sm:min-w-28 sm:text-base"
              type="submit"
              disabled={inputsLocked || !answer.trim()}
            >
              <Send size={20} aria-hidden="true" />
              <span className="hidden sm:inline">Submit</span>
            </button>
          </form>

          <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:gap-3">
            <ControlButton icon={<Flag size={20} />} label="Pass" disabled={inputsLocked} onClick={() => handlePass()} />
            <ControlButton icon={<Trophy size={20} />} label="Reveal" disabled={inputsLocked} onClick={() => emit({ type: "reveal" })} />
            <ControlButton icon={<FastForward size={20} />} label="Next" disabled={isBusy || isComplete} onClick={() => emit({ type: "nextQuestion" })} />
          </div>

          <section className="grid gap-3" aria-label="Push to talk backup">
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:gap-3">
              {state.players.map((player) => (
                <TalkButton
                  key={player.id}
                  player={player}
                  isActive={player.id === state.onTheClockPlayerId}
                  isListening={speech.status.isListening && speech.status.activePlayerId === player.id}
                  isSpeaking={speech.status.isSpeaking}
                  isAvailable={speech.status.isRecognitionAvailable}
                  disabled={inputsLocked || speech.isHandsFreeEnabled}
                  onStart={() => speech.startPushToTalk(player.id)}
                  onStop={() => speech.stopPushToTalk(player.id)}
                />
              ))}
            </div>
          </section>

          <div className="grid w-full min-w-0 grid-cols-[repeat(4,minmax(0,1fr))] gap-2 sm:gap-3">
            <OverrideButton label="P1" wideLabel="Award P1" disabled={isBusy || !isResolved} onClick={() => handleOverride("p1")} />
            <OverrideButton label="P2" wideLabel="Award P2" disabled={isBusy || !isResolved} onClick={() => handleOverride("p2")} />
            <OverrideButton label="Tie" disabled={isBusy || !isResolved} onClick={() => handleOverride("tie")} />
            <OverrideButton label="Nobody" disabled={isBusy || !isResolved} onClick={() => handleOverride("nobody")} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-semibold text-headlight/70 sm:text-sm">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Volume2 size={16} aria-hidden="true" />
              <span className="truncate">Voice: {voiceStatusLabel(speech.status, speech.isHandsFreeEnabled)}</span>
            </span>
            {speech.status.isListening ? <span className="shrink-0 font-extrabold text-gold">Listening</span> : null}
            {error ? <span className="min-w-0 basis-full truncate text-buzzer sm:basis-auto">{error}</span> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function DifficultySelector({
  value,
  disabled,
  onChange
}: {
  value: Difficulty;
  disabled: boolean;
  onChange: (difficulty: Difficulty) => void;
}) {
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  return (
    <div className="mx-auto grid min-h-11 w-full min-w-0 max-w-64 grid-cols-3 overflow-hidden rounded-card border border-headlight/20 bg-ink/60 p-1" aria-label="New game difficulty">
      {difficulties.map((difficulty) => {
        const isSelected = difficulty === value;
        return (
          <button
            key={difficulty}
            className={[
              "min-w-0 rounded-card px-1 py-2 text-[0.64rem] font-extrabold uppercase tracking-wide transition disabled:opacity-60 sm:text-xs",
              isSelected ? "bg-gold text-ink shadow-lg shadow-gold/20" : "text-headlight/65 hover:bg-indigo/30 hover:text-headlight"
            ].join(" ")}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onChange(difficulty)}
          >
            <span className="truncate">{difficulty}</span>
          </button>
        );
      })}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-card border border-headlight/30 bg-headlight/10 px-2 py-1 text-[0.66rem] font-extrabold uppercase tracking-wide text-headlight/90 sm:px-3 sm:text-xs">
      {difficulty}
    </span>
  );
}

function HandsFreeButton({
  activePlayerName,
  disabled,
  isAvailable,
  isEnabled,
  isListening,
  isSpeaking,
  onEnable,
  onDisable
}: {
  activePlayerName: string;
  disabled: boolean;
  isAvailable: boolean;
  isEnabled: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const label = !isAvailable
    ? "Voice unavailable"
    : isEnabled && isSpeaking
      ? "Host speaking"
      : isEnabled && isListening
        ? `Listening: ${activePlayerName}`
        : isEnabled
          ? "Hands-free ready"
          : "Enable hands-free";

  const detail = !isAvailable
    ? "Use typed answer"
    : isEnabled && isSpeaking
      ? "Mic paused"
      : isEnabled
        ? "Auto-listening"
        : "Start voice";

  return (
    <button
      className={[
        "inline-flex min-h-16 w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-card border px-4 py-3 text-left transition disabled:opacity-55 sm:min-h-20 sm:px-5",
        isEnabled && isListening
          ? "border-gold bg-gold text-ink shadow-lg shadow-gold/25"
          : isEnabled
            ? "border-indigo bg-indigo/20 text-headlight shadow-lg shadow-indigo/15"
            : "border-indigo bg-indigo text-headlight shadow-lg shadow-indigo/25 hover:brightness-110"
      ].join(" ")}
      type="button"
      aria-pressed={isEnabled}
      disabled={disabled || !isAvailable}
      onClick={isEnabled ? onDisable : onEnable}
    >
      <span className="inline-flex min-w-0 items-center gap-3">
        {isEnabled && isListening ? <Mic size={28} aria-hidden="true" /> : <MicOff size={28} aria-hidden="true" />}
        <span className="min-w-0">
          <span className="block truncate text-lg font-extrabold sm:text-2xl">{label}</span>
          <span className="block truncate text-xs font-bold uppercase tracking-wide opacity-75 sm:text-sm">{detail}</span>
        </span>
      </span>
      <span className="shrink-0 rounded-card border border-current/30 px-3 py-1 text-xs font-extrabold uppercase tracking-wide">
        {isEnabled ? "On" : "Off"}
      </span>
    </button>
  );
}

function TalkButton({
  player,
  isActive,
  isListening,
  isSpeaking,
  isAvailable,
  disabled,
  onStart,
  onStop
}: {
  player: Player;
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isAvailable: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const isDisabled = disabled || !isActive || !isAvailable;
  const label = isListening ? `Listening: ${player.name}` : `PTT: ${player.name}`;

  return (
    <button
      className={[
        "inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-card border px-2 py-3 text-sm font-extrabold transition disabled:opacity-50 sm:min-h-16 sm:gap-3 sm:px-4 sm:text-base",
        isListening
          ? "border-gold bg-gold text-ink shadow-lg shadow-gold/25"
          : isActive
            ? "border-indigo bg-indigo text-headlight shadow-lg shadow-indigo/25 hover:brightness-110"
            : "border-headlight/20 bg-night text-headlight/55"
      ].join(" ")}
      type="button"
      aria-pressed={isListening}
      disabled={isDisabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onStart();
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        onStop();
      }}
      onPointerCancel={onStop}
      onPointerLeave={(event) => {
        if (event.buttons > 0) {
          onStop();
        }
      }}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          onStart();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          onStop();
        }
      }}
    >
      {isListening ? <Mic size={22} aria-hidden="true" /> : <MicOff size={22} aria-hidden="true" />}
      <span className="min-w-0 truncate">{label}</span>
      {isSpeaking && isActive ? <span className="hidden text-sm font-bold text-headlight/80 sm:inline">paused for host</span> : null}
    </button>
  );
}

function ScoreCard({ player, isActive, isSteal, isWinner }: { player: Player; isActive: boolean; isSteal: boolean; isWinner: boolean }) {
  return (
    <article
      className={[
        "relative min-h-28 w-full min-w-0 overflow-hidden rounded-card border bg-ink/60 p-3 transition sm:min-h-36 sm:p-5",
        isActive ? "border-indigo ring-2 ring-indigo/45 sm:ring-4" : "border-headlight/15",
        isSteal ? "border-buzzer ring-buzzer/45" : "",
        isWinner ? "border-gold bg-gold/10 ring-2 ring-gold/55 sm:ring-4" : ""
      ].join(" ")}
    >
      <div className="min-w-0 pr-12 sm:pr-16">
        <div className="min-w-0">
          <p className="truncate text-[0.66rem] font-bold uppercase tracking-wide text-headlight/65 sm:text-sm">
            {isWinner ? "Winner" : isSteal ? "Steal live" : isActive ? "On the clock" : "Standing by"}
          </p>
          <h2 className="mt-2 truncate text-lg font-extrabold leading-tight text-headlight sm:text-2xl">{player.name}</h2>
        </div>
      </div>
      <p className="absolute right-3 top-3 font-display text-5xl leading-none text-gold sm:right-5 sm:top-5 sm:text-6xl">{player.score}</p>
    </article>
  );
}

function PhaseBadge({ phase }: { phase: GameState["phase"] }) {
  const label = phase === "steal" ? "STEAL" : phase === "complete" ? "FINAL" : phase === "resolved" ? "RESOLVED" : "PRIMARY";
  const className = phase === "steal"
    ? "bg-buzzer text-headlight"
    : phase === "resolved" || phase === "complete"
      ? "bg-gold text-ink"
      : "bg-indigo text-headlight";

  return (
    <span className={`inline-flex min-h-9 shrink-0 items-center rounded-card px-3 py-2 text-[0.68rem] font-extrabold sm:min-h-10 sm:px-4 sm:text-sm ${className}`}>
      {label}
    </span>
  );
}

function ControlButton({
  icon,
  label,
  disabled,
  onClick
}: {
  icon: JSX.Element;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-card bg-indigo px-1.5 py-2 text-[0.66rem] font-extrabold text-headlight shadow-lg shadow-indigo/20 transition hover:brightness-110 disabled:opacity-60 sm:min-h-14 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function OverrideButton({
  label,
  wideLabel,
  disabled,
  onClick
}: {
  label: string;
  wideLabel?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="min-h-11 w-full min-w-0 overflow-hidden rounded-card border border-gold/45 px-1.5 py-2 text-xs font-extrabold text-gold transition hover:bg-gold hover:text-ink disabled:opacity-60 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="sm:hidden">{label}</span>
      <span className="hidden sm:inline">{wideLabel ?? label}</span>
    </button>
  );
}

function voiceStatusLabel(status: ReturnType<typeof useSpeechController>["status"], isHandsFreeEnabled: boolean): string {
  if (!status.isRecognitionAvailable && !status.isSynthesisAvailable) {
    return "unavailable, typed controls ready";
  }

  if (status.isSpeaking) {
    return "host speaking";
  }

  if (status.isListening) {
    return isHandsFreeEnabled ? "hands-free listening" : "push-to-talk listening";
  }

  if (!status.isRecognitionAvailable) {
    return "speech output only";
  }

  if (!status.isSynthesisAvailable) {
    return isHandsFreeEnabled ? "hands-free ready" : "mic ready";
  }

  return isHandsFreeEnabled ? "hands-free ready" : "ready";
}

function winningPlayerId(players: [Player, Player]): PlayerId | "tie" {
  const [first, second] = players;
  if (first.score === second.score) {
    return "tie";
  }

  return first.score > second.score ? first.id : second.id;
}

function resolutionCue(resolution: NonNullable<GameState["resolution"]>): CueName {
  switch (resolution.reason) {
    case "primary_correct":
    case "steal_correct":
      return "onCorrect";
    case "manual_override":
      return Object.values(resolution.awardedPoints).some((points) => (points ?? 0) > 0) ? "onCorrect" : "onWrong";
    default:
      return "onWrong";
  }
}

async function runApi(
  action: () => Promise<GameState>,
  setState: (state: GameState) => void,
  setError: (error: string | null) => void,
  setIsBusy: (isBusy: boolean) => void
) {
  setIsBusy(true);
  setError(null);
  try {
    setState(await action());
  } catch (error) {
    setError(error instanceof Error ? error.message : "Something went wrong");
  } finally {
    setIsBusy(false);
  }
}
