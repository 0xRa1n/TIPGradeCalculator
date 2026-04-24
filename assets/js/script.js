const $ = (id) => document.getElementById(id);
let formCount = 1,
  quizFormCount = 1;

const showErrorModal = (title, content) => {
  if (
    !$("appErrorModal") ||
    !$("appErrorModalLabel") ||
    !$("appErrorModalBody")
  )
    return;

  $("appErrorModalLabel").textContent = title;
  $("appErrorModalBody").textContent = content;
  bootstrap.Modal.getOrCreateInstance($("appErrorModal")).show();
};
window.showErrorModal = showErrorModal;

const normalize = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? null : n > 1 ? n / 100 : n;
};

const addForm = (isQuiz = false) => {
  const c = isQuiz ? ++quizFormCount : ++formCount;
  const type = isQuiz ? "quiz" : "assessment";
  const container = $(isQuiz ? "quizFormsContainer" : "formsContainer");
  const html = `
    <div class="${type}-row row g-3 mb-3 position-relative">
      <div class="col-md-6">
        <div class="form-floating">
          <input type="number" class="form-control ${type}-score" id="${type}ScoreInput${c}" placeholder="0"/>
          <label for="${type}ScoreInput${c}">${isQuiz ? "Score" : "Assessment Task Score"}</label>
        </div>
      </div>
      <div class="col-md-6 d-flex align-items-center gap-2">
        <div class="form-floating flex-grow-1">
          <input type="number" class="form-control ${type}-outof" id="${type}OutOfInput${c}" placeholder="0"/>
          <label for="${type}OutOfInput${c}">Out Of</label>
        </div>
        <button
          type="button"
          class="remove-row-btn btn btn-link text-danger text-decoration-none p-0"
          aria-label="Remove ${isQuiz ? "quiz" : "assessment"} entry"
          style="font-size:1rem;line-height:1;"
        >
          X
        </button>
      </div>
    </div>`;
  container.insertAdjacentHTML("beforeend", html);
};

const removeRow = (event) => {
  const btn = event.target.closest(".remove-row-btn");
  if (!btn) return;

  const row = btn.closest(".assessment-row, .quiz-row");
  if (row) row.remove();
};

const calcSection = ({
  section,
  container,
  percentSel,
  rowSel,
  scoreSel,
  outOfSel,
}) => {
  const percentInput = container.querySelector(percentSel);
  if (!percentInput || !percentInput.value.trim()) {
    showErrorModal(
      `Missing ${section} Percentage`,
      `Please enter a percentage for ${section} before calculating.`,
    );
    return null;
  }
  const norm = normalize(percentInput.value.trim());
  if (norm === null) {
    showErrorModal(
      `Invalid ${section} Percentage`,
      `Please enter a valid percentage value for ${section}.`,
    );
    return null;
  }
  const rows = container.querySelectorAll(rowSel);
  const vals = Array.from(rows)
    .map((row, i) => {
      const s = row.querySelector(scoreSel)?.value.trim(),
        o = row.querySelector(outOfSel)?.value.trim();
      return s !== "" || o !== "" ? { s, o } : null;
    })
    .filter(Boolean);
  if (!vals.length) {
    showErrorModal(
      `Missing ${section} Entries`,
      `Please fill at least one Score and Out Of pair for ${section}.`,
    );
    return null;
  }

  const percs = vals.map((v) =>
    Number(((Number(v.s) / Number(v.o)) * 50 + 50).toFixed(2)),
  );
  console.log({ percs });
  const avg = Number(
    (percs.reduce((a, b) => a + b, 0) / percs.length).toFixed(2),
  );

  const partial = Number((avg * norm).toFixed(2));
  return { average: avg, partial };
};

const calcAll = () => {
  const assess = calcSection({
    section: "Assessment Tasks",
    container: $("formsContainer"),
    percentSel: "#floatingInput",
    rowSel: ".assessment-row",
    scoreSel: ".assessment-score",
    outOfSel: ".assessment-outof",
  });
  if (!assess) return;
  const quiz = calcSection({
    section: "Quiz",
    container: $("quizFormsContainer"),
    percentSel: "#floatingQuizInput",
    rowSel: ".quiz-row",
    scoreSel: ".quiz-score",
    outOfSel: ".quiz-outof",
  });
  if (!quiz) return;

  console.log({ assess, quiz });

  // get the partial of assessmentTasks and quiz, then sum them up
  const total = Number((assess.partial + quiz.partial).toFixed(2));

  // parse the input from floatingExamInput
  const examScoreInput = $("examScoreInput1").value;
  const examOutOfInput = $("examOutOfInput1").value;
  const examPercentage = Number(
    ((Number(examScoreInput) / Number(examOutOfInput)) * 50 + 50).toFixed(2),
  );
  const finalTotal = Number((0.5 * examPercentage + 0.5 * total).toFixed(2));

  // create Bootstrap card element to show the result
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="card-body">Your class standing is <strong>${total}%</strong> (${assess.partial}% from Assessment Tasks and ${quiz.partial}% from Quiz).<br>Your final grade for the <b>PRELIM</b> is <strong>${finalTotal}%</strong>.</div>`;

  $("results").replaceChildren(card);
};
$("addFormBtn").addEventListener("click", () => addForm(false));
$("addQuizFormBtn").addEventListener("click", () => addForm(true));
$("calculateBtn").addEventListener("click", calcAll);
$("formsContainer").addEventListener("click", removeRow);
$("quizFormsContainer").addEventListener("click", removeRow);
