const lessons = Array.isArray(window.PRIMA_NOVA_DATA) ? window.PRIMA_NOVA_DATA : [];

const storageKey = "primanova-progress-v1";
const sessionKey = "primanova-session-v1";
const dueSteps = [0, 1, 2, 4, 7, 12];

const els = {
  lessonStart: document.querySelector("#lesson-start"),
  lessonEnd: document.querySelector("#lesson-end"),
  modeSelect: document.querySelector("#mode-select"),
  sessionSize: document.querySelector("#session-size"),
  overviewStats: document.querySelector("#overview-stats"),
  startSession: document.querySelector("#start-session"),
  resetProgress: document.querySelector("#reset-progress"),
  emptyState: document.querySelector("#empty-state"),
  trainer: document.querySelector("#trainer"),
  summary: document.querySelector("#session-summary"),
  sessionHeadline: document.querySelector("#session-headline"),
  progressCount: document.querySelector("#progress-count"),
  progressMode: document.querySelector("#progress-mode"),
  progressFill: document.querySelector("#progress-fill"),
  cardLesson: document.querySelector("#card-lesson"),
  cardBox: document.querySelector("#card-box"),
  cardFront: document.querySelector("#card-front"),
  cardContext: document.querySelector("#card-context"),
  multipleChoice: document.querySelector("#multiple-choice"),
  optionGrid: document.querySelector("#option-grid"),
  freeAnswer: document.querySelector("#free-answer"),
  freeInput: document.querySelector("#free-input"),
  revealAnswer: document.querySelector("#reveal-answer"),
  feedbackPanel: document.querySelector("#feedback-panel"),
  solutionText: document.querySelector("#solution-text"),
  selfcheckCopy: document.querySelector("#selfcheck-copy"),
  markCorrect: document.querySelector("#mark-correct"),
  markWrong: document.querySelector("#mark-wrong"),
  feedbackRating: document.querySelector("#feedback-rating"),
  feedbackStrength: document.querySelector("#feedback-strength"),
  feedbackGap: document.querySelector("#feedback-gap"),
  feedbackNext: document.querySelector("#feedback-next"),
  copyFeedback: document.querySelector("#copy-feedback"),
  emailFeedback: document.querySelector("#email-feedback"),
  feedbackStatus: document.querySelector("#feedback-status"),
};

const state = {
  progress: loadJson(storageKey, { cards: {} }),
  sessionMeta: loadJson(sessionKey, { counter: 0 }),
  session: null,
};

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function shuffle(input) {
  const copy = [...input];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getLessonOptions() {
  return lessons.map((lesson) => lesson.lesson);
}

function fillLessonSelects() {
  const options = getLessonOptions();
  for (const lessonId of options) {
    const label = `Lektion ${lessonId}`;
    els.lessonStart.append(new Option(label, lessonId));
    els.lessonEnd.append(new Option(label, lessonId));
  }
  els.lessonStart.value = "1";
  els.lessonEnd.value = String(Math.min(23, options.at(-1) || 1));
}

function selectedLessons() {
  const start = Number(els.lessonStart.value);
  const end = Number(els.lessonEnd.value);
  return lessons.filter((lesson) => lesson.lesson >= start && lesson.lesson <= end);
}

function flattenLessons(subset) {
  return subset.flatMap((lesson) =>
    lesson.cards.map((card, index) => ({
      ...card,
      lesson: lesson.lesson,
      title: lesson.title,
      ordinal: index + 1,
    })),
  );
}

function getCardProgress(cardId) {
  return state.progress.cards[cardId] || {
    box: 0,
    seen: 0,
    correct: 0,
    wrong: 0,
    dueSession: 0,
  };
}

function saveProgress() {
  saveJson(storageKey, state.progress);
}

function updateOverview() {
  const cards = flattenLessons(selectedLessons());
  const dueNow = cards.filter((card) => getCardProgress(card.id).dueSession <= state.sessionMeta.counter)
    .length;
  const mastered = cards.filter((card) => getCardProgress(card.id).box >= 4).length;
  const unseen = cards.filter((card) => !state.progress.cards[card.id]).length;
  const total = cards.length;

  els.overviewStats.innerHTML = "";
  [
    ["Karten im Filter", total],
    ["Jetzt faellig", dueNow],
    ["Noch neu", unseen],
    ["Langzeitfach", mastered],
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    els.overviewStats.append(card);
  });
}

function buildSessionQueue(cards, size) {
  const due = [];
  const fresh = [];
  const later = [];

  for (const card of cards) {
    const progress = getCardProgress(card.id);
    if (!state.progress.cards[card.id]) {
      fresh.push(card);
    } else if (progress.dueSession <= state.sessionMeta.counter) {
      due.push(card);
    } else {
      later.push(card);
    }
  }

  const queue = [];
  queue.push(...shuffle(due).slice(0, size));

  if (queue.length < size) {
    queue.push(...shuffle(fresh).slice(0, size - queue.length));
  }

  if (queue.length < size) {
    queue.push(...shuffle(later).slice(0, size - queue.length));
  }

  return shuffle(queue).map((card) => ({ card, reason: "scheduled" }));
}

function startSession() {
  state.sessionMeta.counter += 1;
  saveJson(sessionKey, state.sessionMeta);

  const cards = flattenLessons(selectedLessons());
  const size = Number(els.sessionSize.value);
  const queue = buildSessionQueue(cards, size);
  state.session = {
    total: queue.length,
    queue,
    completed: 0,
    correct: 0,
    wrong: 0,
    current: null,
    questionMode: null,
    answered: false,
  };

  els.summary.classList.add("hidden");
  els.emptyState.classList.add("hidden");
  els.trainer.classList.remove("hidden");
  els.trainer.scrollIntoView({ behavior: "smooth", block: "start" });

  nextCard();
}

function sessionModeLabel(mode) {
  return {
    mixed: "Mix",
    free: "Freie Eingabe",
    multiple: "Auswahl",
  }[mode] || mode;
}

function pickQuestionMode() {
  const mode = els.modeSelect.value;
  if (mode !== "mixed") return mode;
  return Math.random() > 0.5 ? "free" : "multiple";
}

function nextCard() {
  if (!state.session || state.session.queue.length === 0) {
    finishSession();
    return;
  }

  state.session.current = state.session.queue.shift();
  state.session.answered = false;
  state.session.questionMode = pickQuestionMode();

  renderCard();
}

function renderCard() {
  const current = state.session.current.card;
  const progress = getCardProgress(current.id);
  const answered = state.session.answered;
  const position = state.session.completed + 1;

  els.sessionHeadline.textContent = `Session ${state.sessionMeta.counter} mit ${state.session.total} Karten`;
  els.progressCount.textContent = `${Math.min(position, state.session.total)} / ${state.session.total}`;
  els.progressMode.textContent = sessionModeLabel(state.session.questionMode);
  els.progressFill.style.width = `${(state.session.completed / Math.max(state.session.total, 1)) * 100}%`;
  els.cardLesson.textContent = `Lektion ${current.lesson}`;
  els.cardBox.textContent = `Fach ${progress.box + 1}`;
  els.cardFront.textContent = current.latin;
  els.cardContext.textContent = current.title ? current.title : "";

  els.feedbackPanel.classList.add("hidden");
  els.solutionText.textContent = current.meaning;
  els.selfcheckCopy.textContent = "";
  els.freeInput.value = "";

  if (state.session.questionMode === "multiple") {
    renderMultipleChoice(current, answered);
    els.multipleChoice.classList.remove("hidden");
    els.freeAnswer.classList.add("hidden");
  } else {
    els.multipleChoice.classList.add("hidden");
    els.freeAnswer.classList.remove("hidden");
  }
}

function renderMultipleChoice(current, answered) {
  const pool = flattenLessons(selectedLessons())
    .filter((card) => card.id !== current.id)
    .map((card) => card.meaning);
  const distractors = shuffle([...new Set(pool)]).slice(0, 3);
  const options = shuffle([current.meaning, ...distractors]);

  els.optionGrid.innerHTML = "";
  for (const option of options) {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.disabled = answered;
    button.addEventListener("click", () => handleMultipleChoice(option, button));
    els.optionGrid.append(button);
  }
}

function handleMultipleChoice(selected, button) {
  if (state.session.answered) return;
  state.session.answered = true;

  const correct = selected === state.session.current.card.meaning;
  for (const optionButton of els.optionGrid.querySelectorAll(".option-btn")) {
    if (optionButton.textContent === state.session.current.card.meaning) {
      optionButton.classList.add("correct");
    } else if (optionButton === button && !correct) {
      optionButton.classList.add("wrong");
    }
    optionButton.disabled = true;
  }

  window.setTimeout(() => applyAnswer(correct), 480);
}

function revealFreeAnswer() {
  if (state.session.answered) return;
  state.session.answered = true;
  els.feedbackPanel.classList.remove("hidden");
  els.selfcheckCopy.textContent = els.freeInput.value.trim()
    ? `Deine Eingabe: ${els.freeInput.value.trim()}`
    : "Keine Eingabe. Du kannst die Karte trotzdem als richtig oder falsch markieren.";
}

function applyAnswer(correct) {
  const currentCard = state.session.current.card;
  const progress = getCardProgress(currentCard.id);
  progress.seen += 1;

  if (correct) {
    progress.correct += 1;
    progress.box = Math.min(progress.box + 1, dueSteps.length - 1);
    progress.dueSession = state.sessionMeta.counter + dueSteps[progress.box];
    state.session.correct += 1;
  } else {
    progress.wrong += 1;
    progress.box = Math.max(progress.box - 1, 0);
    progress.dueSession = state.sessionMeta.counter;
    state.session.wrong += 1;

    // Falsche Karten tauchen schnell und mehrfach wieder auf.
    state.session.queue.splice(1, 0, { card: currentCard, reason: "retry-fast" });
    state.session.queue.splice(Math.min(4, state.session.queue.length), 0, {
      card: currentCard,
      reason: "retry-later",
    });
  }

  state.progress.cards[currentCard.id] = progress;
  state.session.completed += 1;
  saveProgress();
  updateOverview();
  nextCard();
}

function finishSession() {
  els.trainer.classList.add("hidden");
  els.emptyState.classList.add("hidden");
  els.summary.classList.remove("hidden");
  els.summary.innerHTML = `
    <h3>Session abgeschlossen</h3>
    <p>Die falschen Karten wurden in kuerzeren Abstaenden wieder in die Queue gemischt. Sichere Karten wandern in spaetere Session-Intervalle.</p>
    <div class="summary-grid">
      <div class="summary-tile"><strong>${state.session.total}</strong><span>Bearbeitet</span></div>
      <div class="summary-tile"><strong>${state.session.correct}</strong><span>Richtig</span></div>
      <div class="summary-tile"><strong>${state.session.wrong}</strong><span>Nochmal faellig</span></div>
    </div>
  `;
  state.session = null;
}

function resetProgress() {
  state.progress = { cards: {} };
  state.sessionMeta = { counter: 0 };
  saveJson(storageKey, state.progress);
  saveJson(sessionKey, state.sessionMeta);
  state.session = null;
  els.trainer.classList.add("hidden");
  els.summary.classList.add("hidden");
  els.emptyState.classList.remove("hidden");
  els.sessionHeadline.textContent = "Noch keine Session aktiv.";
  updateOverview();
}

function buildFeedbackText() {
  return [
    "Feedback zur PrimaNova-Trainer-Demo",
    "",
    `Gesamteindruck: ${els.feedbackRating.value}`,
    `Stark: ${els.feedbackStrength.value.trim() || "-"}`,
    `Fehlt oder stoert: ${els.feedbackGap.value.trim() || "-"}`,
    `Naechster Schritt aus Sicht der Schule: ${els.feedbackNext.value}`,
  ].join("\n");
}

async function copyFeedback() {
  const text = buildFeedbackText();
  try {
    await navigator.clipboard.writeText(text);
    els.feedbackStatus.textContent = "Feedbacktext in die Zwischenablage kopiert.";
  } catch {
    els.feedbackStatus.textContent = "Kopieren hat hier nicht geklappt. Du kannst den Text aber manuell uebernehmen.";
  }
}

function mailFeedback() {
  const subject = encodeURIComponent("Feedback zur PrimaNova Trainer Demo");
  const body = encodeURIComponent(buildFeedbackText());
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  els.feedbackStatus.textContent = "Mail-Entwurf wurde vorbereitet.";
}

function clampLessonRange() {
  if (Number(els.lessonStart.value) > Number(els.lessonEnd.value)) {
    els.lessonEnd.value = els.lessonStart.value;
  }
  updateOverview();
}

els.startSession.addEventListener("click", startSession);
els.resetProgress.addEventListener("click", resetProgress);
els.revealAnswer.addEventListener("click", revealFreeAnswer);
els.markCorrect.addEventListener("click", () => applyAnswer(true));
els.markWrong.addEventListener("click", () => applyAnswer(false));
els.copyFeedback.addEventListener("click", copyFeedback);
els.emailFeedback.addEventListener("click", mailFeedback);
els.lessonStart.addEventListener("change", clampLessonRange);
els.lessonEnd.addEventListener("change", updateOverview);
els.modeSelect.addEventListener("change", updateOverview);
els.sessionSize.addEventListener("change", updateOverview);

fillLessonSelects();
updateOverview();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
