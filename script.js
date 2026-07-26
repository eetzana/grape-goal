const STORAGE_KEY = "grapeGoalState";
const pages = document.querySelectorAll(".page");

const goalForm = document.querySelector("#goalForm");
const goalInput = document.querySelector("#goalInput");
const taskInput = document.querySelector("#taskInput");
const customCount = document.querySelector("#customCount");
const continueCard = document.querySelector("#continueCard");
const continueGoal = document.querySelector("#continueGoal");
const continueMeta = document.querySelector("#continueMeta");
const continueButton = document.querySelector("#continueButton");

const progressGoal = document.querySelector("#progressGoal");
const progressTask = document.querySelector("#progressTask");
const progressText = document.querySelector("#progressText");
const progressPercent = document.querySelector("#progressPercent");
const progressGrapes = document.querySelector("#progressGrapes");
const fillButton = document.querySelector("#fillButton");
const undoButton = document.querySelector("#undoButton");
const backToStart = document.querySelector("#backToStart");

const completeGoal = document.querySelector("#completeGoal");
const completeCount = document.querySelector("#completeCount");
const completeGrapes = document.querySelector("#completeGrapes");
const restartSame = document.querySelector("#restartSame");
const newGoal = document.querySelector("#newGoal");
const crayonCursor = document.querySelector("#crayonCursor");

let state = loadState();
let isDrawing = false;
let drawShouldFill = true;
const touchedDuringDrag = new Set();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState() {
  state = null;
  localStorage.removeItem(STORAGE_KEY);
}

function showPage(name) {
  pages.forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === name);
  });
}

function normalizeState() {
  if (!state) return;

  if (!Array.isArray(state.filled) || state.filled.length !== state.total) {
    state.filled = Array.from({ length: state.total }, (_, index) => index < state.completed);
  }

  state.completed = state.filled.filter(Boolean).length;
  state.status = state.completed >= state.total ? "complete" : "progress";
}

function clampCount(value) {
  const count = Number.parseInt(value, 10);
  if (Number.isNaN(count)) return 7;
  return Math.min(Math.max(count, 1), 60);
}

function getSelectedCount() {
  const selected = document.querySelector('input[name="grapeCount"]:checked').value;
  return selected === "custom" ? clampCount(customCount.value) : clampCount(selected);
}

function updateContinueCard() {
  if (!state) {
    continueCard.hidden = true;
    return;
  }

  normalizeState();
  continueGoal.textContent = state.goal;
  continueMeta.textContent = `${state.completed} / ${state.total}알`;
  continueCard.hidden = false;
}

function renderProgress() {
  if (!state) return;

  normalizeState();
  progressGoal.textContent = state.goal;
  progressTask.textContent = state.task;
  progressText.textContent = `${state.completed} / ${state.total}알`;
  progressPercent.textContent = `${Math.round((state.completed / state.total) * 100)}%`;

  renderGrapes(progressGrapes, state.total, state.filled);
  fillButton.disabled = state.completed >= state.total;
  undoButton.disabled = state.completed <= 0;
}

function renderComplete() {
  if (!state) return;

  normalizeState();
  completeGoal.textContent = state.goal;
  completeCount.textContent = `총 ${state.total}회 수행`;
  renderGrapes(completeGrapes, state.total, Array.from({ length: state.total }, () => true));
}

function renderGrapes(container, total, filled) {
  container.innerHTML = "";
  const points = makeGrapePoints(total);
  const fragment = document.createDocumentFragment();

  points.forEach((point, index) => {
    const grape = document.createElement("button");
    grape.className = "grape";
    grape.type = "button";
    grape.dataset.index = index;
    if (filled[index]) grape.classList.add("is-filled");
    grape.style.left = `${point.x}%`;
    grape.style.top = `${point.y}px`;
    grape.style.setProperty("--size", `${point.size}px`);
    grape.setAttribute("aria-label", `${index + 1}번째 포도알`);
    fragment.appendChild(grape);

    const number = document.createElement("span");
    number.className = "grape-number";
    if (filled[index]) number.classList.add("is-filled");
    number.dataset.index = index;
    number.style.left = `${point.x}%`;
    number.style.top = `${point.y}px`;
    number.style.setProperty("--size", `${point.size}px`);
    number.textContent = index + 1;
    fragment.appendChild(number);
  });

  container.appendChild(fragment);
}

// Creates a loose hand-drawn bunch while keeping every grape inside the fixed canvas.
function makeGrapePoints(total) {
  const rowShape = total <= 7
    ? [2, 3, 2]
    : total <= 14
      ? [3, 4, 4, 2, 1]
      : total <= 30
        ? [3, 5, 5, 5, 4, 4, 3, 1]
        : [5, 7, 8, 9, 9, 8, 6, 5, 3];
  const rows = fitRowsToTotal(rowShape, total);
  const maxRow = Math.max(...rows);
  const baseSize = total > 30 ? 44 : total > 14 ? 56 : 70;
  const horizontalStep = baseSize * 0.76;
  const verticalGap = baseSize * 0.64;
  const startY = 46;
  const bunchWidth = 340;

  return rows.flatMap((rowCount, row) => {
    const rowWidth = (rowCount - 1) * horizontalStep;
    const startX = (bunchWidth - rowWidth) / 2;

    return Array.from({ length: rowCount }, (_, col) => {
      const sizeOffsets = [-7, 5, -3, 8, -5, 3, 0, 6, -6];
      const sizeOffset = sizeOffsets[(row * 3 + col) % sizeOffsets.length];
      return {
        x: rowCount === 1 ? 50 : ((startX + col * horizontalStep) / bunchWidth) * 100,
        y: startY + row * verticalGap,
        size: baseSize + sizeOffset * 2,
      };
    });
  });
}

function fitRowsToTotal(rowShape, total) {
  const shapeTotal = rowShape.reduce((sum, count) => sum + count, 0);
  const rawRows = rowShape.map((count) => (count / shapeTotal) * total);
  const rows = rawRows.map((count) => Math.max(1, Math.floor(count)));

  while (rows.reduce((sum, count) => sum + count, 0) < total) {
    const index = rawRows
      .map((rawCount, i) => ({ index: i, remainder: rawCount - Math.floor(rawCount) }))
      .sort((a, b) => b.remainder - a.remainder)[0].index;
    rows[index] += 1;
  }

  while (rows.reduce((sum, count) => sum + count, 0) > total) {
    const removable = rows
      .map((count, index) => ({ count, index }))
      .filter((row) => row.count > 1)
      .sort((a, b) => b.count - a.count)[0];
    if (!removable) break;
    rows[removable.index] -= 1;
  }

  return rows.filter(Boolean);
}

function startGoal(event) {
  event.preventDefault();

  const goal = goalInput.value.trim();
  const task = taskInput.value.trim();
  const total = getSelectedCount();

  if (!goal || !task) return;

  state = {
    goal,
    task,
    total,
    completed: 0,
    filled: Array.from({ length: total }, () => false),
    status: "progress",
    updatedAt: new Date().toISOString(),
  };

  saveState();
  renderProgress();
  showPage("progress");
}

function fillOneGrape() {
  if (!state || state.completed >= state.total) return;

  normalizeState();
  const nextIndex = state.filled.findIndex((isFilled) => !isFilled);
  setGrape(nextIndex, true);
}

function undoOneGrape() {
  if (!state || state.completed <= 0) return;

  normalizeState();
  const lastIndex = state.filled.lastIndexOf(true);
  setGrape(lastIndex, false);
}

function setGrape(index, shouldFill) {
  if (!state || index < 0 || index >= state.total) return;
  normalizeState();
  if (state.filled[index] === shouldFill) return;

  state.filled[index] = shouldFill;
  state.completed = state.filled.filter(Boolean).length;
  state.status = state.completed >= state.total ? "complete" : "progress";
  state.updatedAt = new Date().toISOString();
  saveState();

  const grape = progressGrapes.querySelector(`[data-index="${index}"]`);
  if (grape) {
    grape.classList.toggle("is-filled", shouldFill);
  }

  const number = progressGrapes.querySelector(`.grape-number[data-index="${index}"]`);
  if (number) number.classList.toggle("is-filled", shouldFill);

  progressText.textContent = `${state.completed} / ${state.total}알`;
  progressPercent.textContent = `${Math.round((state.completed / state.total) * 100)}%`;
  fillButton.disabled = state.completed >= state.total;
  undoButton.disabled = state.completed <= 0;

  if (state.status === "complete") {
    window.setTimeout(() => {
      renderComplete();
      showPage("complete");
      hideCrayon();
    }, 520);
  }
}

function getGrapeFromPointer(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  return target?.closest?.("#progressGrapes .grape");
}

function handleGrapePointerDown(event) {
  const grape = event.target.closest(".grape");
  if (!grape || !state) return;

  event.preventDefault();
  isDrawing = true;
  touchedDuringDrag.clear();
  drawShouldFill = !grape.classList.contains("is-filled");
  progressGrapes.setPointerCapture?.(event.pointerId);
  moveCrayon(event);
  applyPointerToGrape(grape);
}

function handleGrapePointerMove(event) {
  moveCrayon(event);
  if (!isDrawing) return;

  const grape = getGrapeFromPointer(event);
  if (grape) applyPointerToGrape(grape);
}

function applyPointerToGrape(grape) {
  const index = Number.parseInt(grape.dataset.index, 10);
  if (touchedDuringDrag.has(index)) return;
  touchedDuringDrag.add(index);
  setGrape(index, drawShouldFill);
}

function stopDrawing() {
  isDrawing = false;
  touchedDuringDrag.clear();
}

function moveCrayon(event) {
  if (event.pointerType === "touch") return;
  crayonCursor.style.display = "block";
  crayonCursor.style.left = `${event.clientX}px`;
  crayonCursor.style.top = `${event.clientY}px`;
}

function hideCrayon() {
  crayonCursor.style.display = "none";
}

function restartSameGoal() {
  if (!state) return;

  state = {
    ...state,
    completed: 0,
    filled: Array.from({ length: state.total }, () => false),
    status: "progress",
    updatedAt: new Date().toISOString(),
  };
  saveState();
  renderProgress();
  showPage("progress");
}

function goToStartWithCurrentState() {
  updateContinueCard();
  showPage("start");
}

goalForm.addEventListener("submit", startGoal);
continueButton.addEventListener("click", () => {
  if (!state) return;
  if (state.status === "complete") {
    renderComplete();
    showPage("complete");
  } else {
    renderProgress();
    showPage("progress");
  }
});
fillButton.addEventListener("click", fillOneGrape);
undoButton.addEventListener("click", undoOneGrape);
progressGrapes.addEventListener("pointerdown", handleGrapePointerDown);
progressGrapes.addEventListener("pointermove", handleGrapePointerMove);
progressGrapes.addEventListener("pointerleave", hideCrayon);
progressGrapes.addEventListener("pointerup", stopDrawing);
progressGrapes.addEventListener("pointercancel", stopDrawing);
window.addEventListener("pointerup", stopDrawing);
backToStart.addEventListener("click", goToStartWithCurrentState);
restartSame.addEventListener("click", restartSameGoal);
newGoal.addEventListener("click", () => {
  clearState();
  goalForm.reset();
  customCount.value = "";
  updateContinueCard();
  showPage("start");
});

document.querySelectorAll('input[name="grapeCount"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.value === "custom") customCount.focus();
  });
});

customCount.addEventListener("focus", () => {
  document.querySelector('input[name="grapeCount"][value="custom"]').checked = true;
});

updateContinueCard();

if (state?.status === "complete") {
  renderComplete();
  showPage("complete");
} else {
  showPage("start");
}
