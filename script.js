import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase,
  onValue,
  ref,
  runTransaction,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const MAX_PARTICIPANTS = 10;
const MAX_HE = 20;
const ROOM_ID = "main";

const firebaseConfig = {
  apiKey: "AIzaSyDy1UYmK39pADBwLZVc0AShQEvFI5MTbY4",
  authDomain: "trivia-button.firebaseapp.com",
  databaseURL: "https://trivia-button-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "trivia-button",
  storageBucket: "trivia-button.firebasestorage.app",
  messagingSenderId: "66549058215",
  appId: "1:66549058215:web:6964e127b009fbaf316982",
};

const participantsEl = document.querySelector("#participants");
const participantTemplate = document.querySelector("#participant-template");
const participantCountEl = document.querySelector("#participant-count");
const totalCountEl = document.querySelector("#total-count");
const resetButton = document.querySelector("#reset-button");
const controlsEl = document.querySelector(".controls");
const sharePanelEl = document.querySelector("#share-panel");
const shareLinksEl = document.querySelector("#share-links");
const heSound = new Audio("assets/hee.mp3");

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const roomRef = ref(db, `rooms/${ROOM_ID}`);

const params = new URLSearchParams(window.location.search);
const participantParam = Number(params.get("participant"));
const participantIndex =
  Number.isInteger(participantParam) && participantParam >= 1 && participantParam <= MAX_PARTICIPANTS
    ? participantParam - 1
    : null;
const isParticipantView = participantIndex !== null;

let state = createDefaultState();
let previousCounts = [...state.counts];
let hasLoaded = false;

document.body.classList.toggle("mc-view", !isParticipantView);
document.body.classList.toggle("participant-view", isParticipantView);
controlsEl.hidden = isParticipantView;
sharePanelEl.hidden = isParticipantView;

participantCountEl.addEventListener("change", () => {
  update(roomRef, {
    participantCount: clamp(participantCountEl.value, 1, MAX_PARTICIPANTS),
  });
});

resetButton.addEventListener("click", () => {
  set(ref(db, `rooms/${ROOM_ID}/counts`), Array(MAX_PARTICIPANTS).fill(0));
});

renderShareLinks();

onValue(roomRef, (snapshot) => {
  const remoteState = snapshot.val();

  if (!remoteState) {
    set(roomRef, createDefaultState());
    return;
  }

  previousCounts = [...state.counts];
  state = normalizeState(remoteState);
  render();
  showNewMaxEffects();
  hasLoaded = true;
});

function createDefaultState() {
  return {
    participantCount: MAX_PARTICIPANTS,
    counts: Array(MAX_PARTICIPANTS).fill(0),
    names: Array.from({ length: MAX_PARTICIPANTS }, (_, index) => `参加者 ${index + 1}`),
  };
}

function normalizeState(value) {
  return {
    participantCount: clamp(value.participantCount ?? MAX_PARTICIPANTS, 1, MAX_PARTICIPANTS),
    counts: normalizeCounts(value.counts),
    names: normalizeNames(value.names),
  };
}

function normalizeCounts(counts) {
  return Array.from({ length: MAX_PARTICIPANTS }, (_, index) => clamp(counts?.[index] ?? 0, 0, MAX_HE));
}

function normalizeNames(names) {
  return Array.from({ length: MAX_PARTICIPANTS }, (_, index) => {
    const name = names?.[index] ?? "";
    return typeof name === "string" && name.trim() ? name : `参加者 ${index + 1}`;
  });
}

function clamp(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function render() {
  participantsEl.replaceChildren();
  participantCountEl.value = String(state.participantCount);

  const indexes = isParticipantView
    ? [participantIndex]
    : Array.from({ length: state.participantCount }, (_, index) => index);

  for (const index of indexes) {
    const card = participantTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = card.querySelector(".name-input");
    const output = card.querySelector("output");
    const button = card.querySelector(".he-button");
    const buttonCount = card.querySelector(".button-count");
    const meter = card.querySelector("meter");
    const count = state.counts[index];
    const displayName = state.names[index] || `参加者 ${index + 1}`;

    card.dataset.index = String(index);
    card.classList.toggle("is-monitor", !isParticipantView);
    card.classList.toggle("is-maxed", count >= MAX_HE);
    nameInput.value = displayName;
    nameInput.placeholder = `参加者 ${index + 1}`;
    nameInput.setAttribute("aria-label", `参加者 ${index + 1} の名前`);
    output.value = count;
    output.textContent = `${count}`;
    buttonCount.textContent = String(count);
    meter.value = count;
    button.disabled = isParticipantView && count >= MAX_HE;
    button.setAttribute("aria-label", `${displayName} のへぇボタン`);

    nameInput.addEventListener("input", () => updateName(index, nameInput.value));
    if (isParticipantView) {
      button.addEventListener("click", () => addHe(index));
    }
    participantsEl.append(card);
  }

  updateTotal();
  renderShareLinks();
}

function updateName(index, value) {
  set(ref(db, `rooms/${ROOM_ID}/names/${index}`), value.trim() || `参加者 ${index + 1}`);
}

function addHe(index) {
  const countRef = ref(db, `rooms/${ROOM_ID}/counts/${index}`);
  playHeSound();

  runTransaction(countRef, (currentValue) => {
    const count = clamp(currentValue ?? 0, 0, MAX_HE);
    return count >= MAX_HE ? count : count + 1;
  });
}

function updateTotal() {
  const total = state.counts.slice(0, state.participantCount).reduce((sum, count) => sum + count, 0);
  totalCountEl.textContent = String(total);
}

function showNewMaxEffects() {
  if (!hasLoaded) return;

  for (let index = 0; index < state.participantCount; index += 1) {
    if (previousCounts[index] < MAX_HE && state.counts[index] === MAX_HE) {
      showMaxEffect(index);
    }
  }
}

function showMaxEffect(index) {
  const card = participantsEl.querySelector(`[data-index="${index}"]`);
  if (!card) return;

  card.classList.remove("show-max");
  void card.offsetWidth;
  card.classList.add("show-max");
  window.setTimeout(() => card.classList.remove("show-max"), 1500);
}

function playHeSound() {
  heSound.currentTime = 0;
  heSound.play().catch(() => {});
}

function renderShareLinks() {
  if (isParticipantView || !shareLinksEl) return;

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";

  shareLinksEl.replaceChildren();
  for (let index = 0; index < state.participantCount; index += 1) {
    const participantUrl = new URL(url);
    participantUrl.searchParams.set("participant", String(index + 1));

    const link = document.createElement("a");
    link.href = participantUrl.toString();
    link.textContent = `${state.names[index] || `参加者 ${index + 1}`}`;
    shareLinksEl.append(link);
  }
}
