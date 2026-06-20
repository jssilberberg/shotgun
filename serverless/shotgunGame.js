const QUESTIONS = [
  {
    id: "movie-001",
    prompt: "What 1975 movie made audiences afraid to go back in the water?",
    answer: "Jaws",
    category: "Movies",
    difficulty: "medium",
    verified: true
  },
  {
    id: "movie-002",
    prompt: "Who directed the 1994 film Pulp Fiction?",
    answer: "Quentin Tarantino",
    category: "Movies",
    difficulty: "medium",
    verified: true
  },
  {
    id: "movie-003",
    prompt: "In The Wizard of Oz, what color are Dorothy's slippers?",
    answer: "Ruby red",
    category: "Movies",
    difficulty: "easy",
    verified: true
  },
  {
    id: "movie-004",
    prompt: "What movie features the line, 'Here's looking at you, kid'?",
    answer: "Casablanca",
    category: "Movies",
    difficulty: "medium",
    verified: true
  },
  {
    id: "movie-005",
    prompt: "What 2019 film won Best Picture at the Academy Awards?",
    answer: "Parasite",
    category: "Movies",
    difficulty: "hard",
    verified: true
  },
  {
    id: "movie-006",
    prompt: "Who plays Forrest Gump in the 1994 film?",
    answer: "Tom Hanks",
    category: "Movies",
    difficulty: "easy",
    verified: true
  },
  {
    id: "movie-007",
    prompt: "What fictional metal powers much of Wakanda's technology in Black Panther?",
    answer: "Vibranium",
    category: "Movies",
    difficulty: "medium",
    verified: true
  },
  {
    id: "movie-008",
    prompt: "What is the name of the hobbit played by Elijah Wood in The Lord of the Rings films?",
    answer: "Frodo Baggins",
    category: "Movies",
    difficulty: "easy",
    verified: true
  },
  {
    id: "movie-009",
    prompt: "Which Studio Ghibli film features a bathhouse for spirits?",
    answer: "Spirited Away",
    category: "Movies",
    difficulty: "medium",
    verified: true
  },
  {
    id: "movie-010",
    prompt: "What 1982 sci-fi film asks whether Rick Deckard is a replicant?",
    answer: "Blade Runner",
    category: "Movies",
    difficulty: "hard",
    verified: true
  }
];

const DEFAULT_SETTINGS = {
  primaryValue: 2,
  stealValue: 1,
  lockInEnabled: false,
  hintPenalty: "none",
  categoryPickEnabled: false,
  firstPlayer: "p1",
  difficulty: "medium",
  questionsPerGame: 10,
  categories: ["Movies"]
};

let state = startGame();

export function getState() {
  return state;
}

export function handleGameEvent(event = {}) {
  switch (event.type) {
    case "startGame":
      state = startGame({ difficulty: parseDifficulty(event.difficulty) });
      break;
    case "submitAnswer":
      state = submitAnswer(state, event);
      break;
    case "pass":
      state = pass(state, event);
      break;
    case "manualOverride":
      state = manualOverride(state, event.award);
      break;
    case "nextQuestion":
      state = nextQuestion(state);
      break;
    case "reveal":
      state = reveal(state);
      break;
    case "requestHint":
      state = {
        ...state,
        hintsUsedThisQuestion: state.hintsUsedThisQuestion + 1,
        lastAction: { type: "requestHint" }
      };
      break;
    default:
      throw new Error(`Unsupported event type: ${event.type}`);
  }

  return state;
}

function startGame(options = {}) {
  const difficulty = options.difficulty ?? "medium";
  const settings = { ...DEFAULT_SETTINGS, difficulty };
  const questionNumber = 1;
  const currentQuestion = questionFor(questionNumber, difficulty);
  const players = [
    { id: "p1", name: "Player 1", score: 0 },
    { id: "p2", name: "Player 2", score: 0 }
  ];
  const onTheClockPlayerId = primaryForQuestion(questionNumber, settings.firstPlayer);

  return {
    players,
    questionNumber,
    onTheClockPlayerId,
    phase: "primary",
    currentQuestion,
    silentGuess: null,
    hintsUsedThisQuestion: 0,
    settings,
    resolution: null,
    lastAction: {
      type: "startGame",
      spokenText: `${playerName(players, onTheClockPlayerId)}, this one's for you. ${currentQuestion.prompt}`
    }
  };
}

function submitAnswer(currentState, event) {
  if (!isAnswerable(currentState.phase) || event.playerId !== currentState.onTheClockPlayerId) {
    return withLastAction(currentState, {
      type: "submitAnswer",
      ignored: true,
      message: "Answer ignored"
    });
  }

  const isCorrect = normalizeAnswer(event.answer) === normalizeAnswer(currentState.currentQuestion.answer);

  if (currentState.phase === "primary") {
    if (isCorrect) {
      return resolveWithAward(currentState, primaryForState(currentState), "primary_correct", {
        type: "submitAnswer",
        ruling: "correct",
        spokenText: `Correct. ${playerName(currentState.players, primaryForState(currentState))} gets two.`
      });
    }

    return {
      ...currentState,
      phase: "steal",
      onTheClockPlayerId: opponentOf(primaryForState(currentState)),
      resolution: null,
      lastAction: {
        type: "submitAnswer",
        ruling: "incorrect",
        message: "Steal offered",
        spokenText: `${playerName(currentState.players, opponentOf(primaryForState(currentState)))}, want to steal it?`
      }
    };
  }

  if (isCorrect) {
    return resolveWithAward(currentState, currentState.onTheClockPlayerId, "steal_correct", {
      type: "submitAnswer",
      ruling: "correct",
      spokenText: `Stolen clean. ${playerName(currentState.players, currentState.onTheClockPlayerId)} gets one.`
    });
  }

  return resolveWithAward(currentState, "nobody", "both_missed", {
    type: "submitAnswer",
    ruling: "incorrect",
    spokenText: `Tough one. The answer was ${currentState.currentQuestion.answer}.`
  });
}

function pass(currentState, event) {
  if (!isAnswerable(currentState.phase) || event.playerId !== currentState.onTheClockPlayerId) {
    return withLastAction(currentState, {
      type: "pass",
      ignored: true,
      message: "Pass ignored"
    });
  }

  if (currentState.phase === "primary") {
    return {
      ...currentState,
      phase: "steal",
      onTheClockPlayerId: opponentOf(primaryForState(currentState)),
      resolution: null,
      lastAction: {
        type: "pass",
        message: "Steal offered",
        spokenText: `${playerName(currentState.players, opponentOf(primaryForState(currentState)))}, want to steal it?`
      }
    };
  }

  return resolveWithAward(currentState, "nobody", "both_missed", {
    type: "pass",
    spokenText: `Nobody gets that one. The answer was ${currentState.currentQuestion.answer}.`
  });
}

function reveal(currentState) {
  if (!isAnswerable(currentState.phase)) {
    return withLastAction(currentState, {
      type: "reveal",
      spokenText: `The answer was ${currentState.currentQuestion.answer}.`
    });
  }

  return resolveWithAward(currentState, "nobody", "both_missed", {
    type: "reveal",
    spokenText: `Nobody gets that one. The answer was ${currentState.currentQuestion.answer}.`
  });
}

function manualOverride(currentState, award) {
  return resolveWithAward(currentState, normalizeAward(award), "manual_override", {
    type: "manualOverride",
    spokenText: "Score adjusted."
  });
}

function nextQuestion(currentState) {
  if (currentState.phase === "complete") {
    return currentState;
  }

  if (currentState.questionNumber >= currentState.settings.questionsPerGame) {
    return {
      ...currentState,
      phase: "complete",
      silentGuess: null,
      lastAction: {
        type: "gameOver",
        spokenText: closingBanter(currentState.players)
      }
    };
  }

  const questionNumber = currentState.questionNumber + 1;
  const onTheClockPlayerId = primaryForQuestion(questionNumber, currentState.settings.firstPlayer);
  const currentQuestion = questionFor(questionNumber, currentState.settings.difficulty);

  return {
    ...currentState,
    questionNumber,
    onTheClockPlayerId,
    phase: "primary",
    currentQuestion,
    silentGuess: null,
    hintsUsedThisQuestion: 0,
    resolution: null,
    lastAction: {
      type: "nextQuestion",
      spokenText: `${playerName(currentState.players, onTheClockPlayerId)}, this one's for you. ${currentQuestion.prompt}`
    }
  };
}

function resolveWithAward(currentState, award, reason, lastAction) {
  const awardedPoints = pointsForAward(currentState, award);
  const players = currentState.players.map((player) => ({
    ...player,
    score: player.score + (awardedPoints[player.id] ?? 0)
  }));

  return {
    ...currentState,
    players,
    phase: "resolved",
    resolution: {
      questionNumber: currentState.questionNumber,
      reason,
      answerRevealed: true,
      award: normalizeAward(award),
      awardedPoints
    },
    lastAction
  };
}

function pointsForAward(currentState, award) {
  if (award === "nobody") {
    return {};
  }

  if (award === "tie") {
    return { p1: 1, p2: 1 };
  }

  const points = currentState.phase === "steal" ? currentState.settings.stealValue : currentState.settings.primaryValue;
  return { [award]: points };
}

function questionFor(questionNumber, difficulty) {
  const matching = QUESTIONS.filter((question) => question.difficulty === difficulty);
  const bank = matching.length > 0 ? matching : QUESTIONS;
  return bank[(questionNumber - 1) % bank.length];
}

function primaryForQuestion(questionNumber, firstPlayer) {
  const isOdd = questionNumber % 2 === 1;
  return isOdd ? firstPlayer : opponentOf(firstPlayer);
}

function primaryForState(currentState) {
  return primaryForQuestion(currentState.questionNumber, currentState.settings.firstPlayer);
}

function opponentOf(playerId) {
  return playerId === "p1" ? "p2" : "p1";
}

function playerName(players, playerId) {
  return players.find((player) => player.id === playerId)?.name ?? playerId;
}

function normalizeAnswer(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeAward(award) {
  return award === "p1" || award === "p2" || award === "tie" || award === "nobody" ? award : "nobody";
}

function parseDifficulty(value) {
  return value === "easy" || value === "medium" || value === "hard" ? value : "medium";
}

function isAnswerable(phase) {
  return phase === "primary" || phase === "steal";
}

function withLastAction(currentState, lastAction) {
  return { ...currentState, lastAction };
}

function closingBanter(players) {
  const [first, second] = players;
  if (first.score === second.score) {
    return "Final score: tied. Nobody gets to be smug.";
  }

  const winner = first.score > second.score ? first : second;
  return `${winner.name} wins. Keys in the bowl, dignity optional.`;
}
