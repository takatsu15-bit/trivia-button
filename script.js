import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
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
const joinLinkEl = document.querySelector("#join-link");
const joinPanelEl = document.querySelector("#join-panel");
const joinFormEl = document.querySelector("#join-form");
const joinNameEl = document.querySelector("#join-name");
const historyPanelEl = document.querySelector("#history-panel");
const historyListEl = document.querySelector("#history-list");
const clearHistoryButton = document.querySelector("#clear-history-button");
const statusMessageEl = document.querySelector("#status-message");
const heSoundEl = document.querySelector("#he-sound");

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const roomRef = ref(db, `rooms/${ROOM_ID}`);

const params = new URLSearchParams(window.location.search);
const isJoinView = params.has("join");
const participantParam = Number(params.get("participant"));
const participantIndex =
  !isJoinView && Number.isInteger(participantParam) && participantParam >= 1 && participantParam <= MAX_PARTICIPANTS
    ? participantParam - 1
    : null;
const isParticipantView = participantIndex !== null;
const isMcView = !isParticipantView && !isJoinView;

let state = createDefaultState();
let previousCounts = [...state.counts];
let hasLoaded = false;
let isEditingName = false;

document.body.classList.toggle("mc-view", isMcView);
document.body.classList.toggle("participant-view", isParticipantView);
document.body.classList.toggle("join-view", isJoinView);
controlsEl.hidden = !isMcView;
sharePanelEl.hidden = !isMcView;
historyPanelEl.hidden = !isMcView;
joinPanelEl.hidden = !isJoinView;

participantCountEl.addEventListener("change", () => {
  update(roomRef, {
    participantCount: clamp(participantCountEl.value, 1, MAX_PARTICIPANTS),
  });
});

resetButton.addEventListener("click", async () => {
  const visibleCounts = state.counts.slice(0, state.participantCount);
  const total = visibleCounts.reduce((sum, count) => sum + count, 0);

  if (total > 0) {
    await push(ref(db, `rooms/${ROOM_ID}/history`), {
      createdAt: Date.now(),
      total,
      participantCount: state.participantCount,
      counts: visibleCounts,
      names: state.names.slice(0, state.participantCount),
    });
  }

  await set(ref(db, `rooms/${ROOM_ID}/counts`), Array(MAX_PARTICIPANTS).fill(0));
});

clearHistoryButton.addEventListener("click", () => {
  remove(ref(db, `rooms/${ROOM_ID}/history`));
});

joinFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = joinNameEl.value.trim();
  if (!name) return;

  setStatus("参加枠を準備しています...");
  const assignedIndex = await assignParticipant(name);

  if (assignedIndex === null) {
    setStatus("参加枠がいっぱいです。MCに確認してください。");
    return;
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("participant", String(assignedIndex + 1));
  window.location.href = url.toString();
});

renderShareLinks();
render();

onValue(roomRef, (snapshot) => {
  setStatus("");
  const remoteState = snapshot.val();

  if (!remoteState) {
    set(roomRef, createDefaultState());
    return;
  }

  previousCounts = [...state.counts];
  state = normalizeState(remoteState);
  if (isEditingName) return;

  render();
  showNewMaxEffects();
  hasLoaded = true;
}, (error) => {
  setStatus(`Firebaseに接続できません: ${error.message}`);
});

function createDefaultState() {
  return {
    participantCount: MAX_PARTICIPANTS,
    counts: Array(MAX_PARTICIPANTS).fill(0),
    names: Array.from({ length: MAX_PARTICIPANTS }, (_, index) => `参加者 ${index + 1}`),
    history: [],
  };
}

function normalizeState(value) {
  return {
    participantCount: clamp(value.participantCount ?? MAX_PARTICIPANTS, 1, MAX_PARTICIPANTS),
    counts: normalizeCounts(value.counts),
    names: normalizeNames(value.names),
    history: normalizeHistory(value.history),
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

function normalizeHistory(history) {
  if (!history || typeof history !== "object") return [];

  return Object.entries(history)
    .map(([id, item]) => ({
      id,
      createdAt: Number(item?.createdAt ?? 0),
      total: clamp(item?.total ?? 0, 0, MAX_PARTICIPANTS * MAX_HE),
      counts: Array.isArray(item?.counts) ? item.counts.map((count) => clamp(count, 0, MAX_HE)) : [],
      names: Array.isArray(item?.names) ? item.names : [],
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);
}

function clamp(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function render() {
  participantsEl.replaceChildren();
  participantCountEl.value = String(state.participantCount);

  if (isJoinView) {
    updateTotal();
    return;
  }

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

    nameInput.addEventListener("focus", () => {
      isEditingName = true;
    });
    nameInput.addEventListener("change", () => updateName(index, nameInput.value));
    nameInput.addEventListener("blur", () => {
      updateName(index, nameInput.value);
      isEditingName = false;
      render();
    });
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.currentTarget.blur();
      }
    });
    if (isParticipantView) {
      button.addEventListener("pointerdown", () => playHeSound(index));
      button.addEventListener("click", () => addHe(index));
    }
    participantsEl.append(card);
  }

  updateTotal();
  renderShareLinks();
  renderHistory();
}

function updateName(index, value) {
  const name = value.trim() || `参加者 ${index + 1}`;
  if (state.names[index] === name) return;

  state.names[index] = name;
  set(ref(db, `rooms/${ROOM_ID}/names/${index}`), name);
}

function addHe(index) {
  const countRef = ref(db, `rooms/${ROOM_ID}/counts/${index}`);

  runTransaction(countRef, (currentValue) => {
    const count = clamp(currentValue ?? 0, 0, MAX_HE);
    return count >= MAX_HE ? count : count + 1;
  });
}

async function assignParticipant(name) {
  let assignedIndex = null;

  const result = await runTransaction(roomRef, (currentValue) => {
    const room = normalizeState(currentValue ?? createDefaultState());
    const existingIndex = room.names.findIndex((candidate) => candidate === name);
    const emptyIndex = room.names
      .slice(0, room.participantCount)
      .findIndex((candidate, index) => candidate === `参加者 ${index + 1}`);
    const targetIndex = existingIndex >= 0 ? existingIndex : emptyIndex;

    if (targetIndex < 0) return;

    assignedIndex = targetIndex;
    room.names[targetIndex] = name;
    return {
      ...currentValue,
      participantCount: room.participantCount,
      counts: room.counts,
      names: room.names,
      history: currentValue?.history ?? {},
    };
  });

  return result.committed ? assignedIndex : null;
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

function playHeSound(index) {
  if (state.counts[index] >= MAX_HE || !heSoundEl) return;

  heSoundEl.pause();
  heSoundEl.currentTime = 0;
  heSoundEl.volume = 1;
  heSoundEl.play().catch((error) => {
    setStatus(`音声を再生できませんでした: ${error.name || "再生エラー"}`);
  });
}

function renderShareLinks() {
  if (!isMcView || !shareLinksEl) return;

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  const joinUrl = new URL(url);
  joinUrl.searchParams.set("join", "1");

  joinLinkEl.href = joinUrl.toString();

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

function renderHistory() {
  if (!isMcView || !historyListEl) return;

  historyListEl.replaceChildren();

  if (!state.history?.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "まだ履歴はありません";
    historyListEl.append(empty);
    return;
  }

  for (const item of state.history) {
    const article = document.createElement("article");
    article.className = "history-item";

    const title = document.createElement("h3");
    title.textContent = `${formatDate(item.createdAt)} / 合計 ${item.total}へぇ`;
    const deleteButton = document.createElement("button");
    deleteButton.className = "history-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => {
      remove(ref(db, `rooms/${ROOM_ID}/history/${item.id}`));
    });
    const header = document.createElement("div");
    header.className = "history-item-header";
    header.append(title, deleteButton);

    const list = document.createElement("div");
    list.className = "history-counts";

    item.counts.forEach((count, index) => {
      const row = document.createElement("span");
      row.textContent = `${item.names[index] || `参加者 ${index + 1}`}: ${count}`;
      list.append(row);
    });

    article.append(header, list);
    historyListEl.append(article);
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "日時不明";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function setStatus(message) {
  statusMessageEl.textContent = message;
  statusMessageEl.hidden = !message;
}
