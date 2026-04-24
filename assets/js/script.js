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

const termLabels = {
  prelim: "Prelim",
  midterm: "Midterm",
  final: "Final",
};

const getRoundingMode = () => $("roundingModeSelect")?.value || "round";
const truncateTo2 = (n) => Math.trunc(Number(n) * 100) / 100;
const roundTo2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const quantizeToMode = (n) => {
  const mode = getRoundingMode();
  return mode === "truncate" ? truncateTo2(n) : roundTo2(n);
};
const fmt2 = (n) => {
  return quantizeToMode(n).toFixed(2);
};

const computeTermGrade = (period, currentRaw, previousGrade = null) => {
  if (period === "prelim") return currentRaw;

  // Midterm/Final: 1/3 of previous period grade + 2/3 of current period raw.
  return previousGrade / 3 + (2 * currentRaw) / 3;
};

const computeCurrentRaw = (classStanding, examPercentage) => {
  // Raw grade inside a period is always 50% exam + 50% class standing.
  return 0.5 * examPercentage + 0.5 * classStanding;
};

const updatePreviousGradeUI = () => {
  const select = $("gradingPeriodSelect");
  const wrap = $("previousGradeWrap");
  const label = $("previousGradeLabel");
  const input = $("previousGradeInput");
  if (!select || !wrap || !label || !input) return;

  const period = select.value;
  if (period === "prelim") {
    wrap.classList.add("d-none");
    input.value = "";
    return;
  }

  wrap.classList.remove("d-none");
  label.textContent = period === "midterm" ? "Prelim Grade" : "Midterm Grade";
};

const parseExamPercentage = () => {
  const examScoreInput = $("examScoreInput1")?.value.trim();
  const examOutOfInput = $("examOutOfInput1")?.value.trim();

  if (!examScoreInput || !examOutOfInput) {
    showErrorModal(
      "Missing Exam Entries",
      "Please enter both Exam Score and Exam Out Of values.",
    );
    return null;
  }

  const score = Number(examScoreInput);
  const outOf = Number(examOutOfInput);
  if (Number.isNaN(score) || Number.isNaN(outOf) || outOf <= 0) {
    showErrorModal(
      "Invalid Exam Entries",
      "Exam Score must be numeric and Exam Out Of must be greater than 0.",
    );
    return null;
  }

  return (score / outOf) * 50 + 50;
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

  const percs = vals.map((v) => (Number(v.s) / Number(v.o)) * 50 + 50);
  console.log({ percs });
  const avg = percs.reduce((a, b) => a + b, 0) / percs.length;

  const partial = avg * norm;
  return { average: avg, partial };
};

const calcAll = () => {
  const selectedPeriod = $("gradingPeriodSelect")?.value || "prelim";

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
  const total = assess.partial + quiz.partial;
  const classStanding = quantizeToMode(total);

  const examPercentage = parseExamPercentage();
  if (examPercentage === null) return;
  const currentRaw = computeCurrentRaw(classStanding, examPercentage);

  let computedGrade = currentRaw;
  let previousGrade = null;
  if (selectedPeriod !== "prelim") {
    const previousLabel = selectedPeriod === "midterm" ? "Prelim" : "Midterm";
    const prevInput = $("previousGradeInput")?.value.trim();

    if (!prevInput) {
      showErrorModal(
        `Missing ${previousLabel} Grade`,
        `Please enter your ${previousLabel} grade before calculating ${termLabels[selectedPeriod]}.`,
      );
      return;
    }

    previousGrade = Number(prevInput);
    if (Number.isNaN(previousGrade)) {
      showErrorModal(
        `Invalid ${previousLabel} Grade`,
        `Please enter a valid numeric value for ${previousLabel} grade.`,
      );
      return;
    }

    computedGrade = computeTermGrade(selectedPeriod, currentRaw, previousGrade);
  }

  // create Bootstrap card element to show the result
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="card-body">Your class standing is <strong>${fmt2(classStanding)}%</strong> (${fmt2(assess.partial)}% from Assessment Tasks and ${fmt2(quiz.partial)}% from Quiz).<br>Your current ${termLabels[selectedPeriod]} raw grade is <strong>${fmt2(currentRaw)}%</strong>.${previousGrade === null ? "" : `<br>Using ${selectedPeriod === "midterm" ? "Prelim" : "Midterm"} grade <strong>${fmt2(previousGrade)}%</strong> and current raw grade, your computed <b>${termLabels[selectedPeriod].toUpperCase()}</b> grade is <strong>${fmt2(computedGrade)}%</strong>.`}${previousGrade === null ? `<br>Your final grade for <b>PRELIM</b> is <strong>${fmt2(computedGrade)}%</strong>.` : ""}</div>`;

  $("results").replaceChildren(card);
};
$("addFormBtn").addEventListener("click", () => addForm(false));
$("addQuizFormBtn").addEventListener("click", () => addForm(true));
$("calculateBtn").addEventListener("click", calcAll);
$("roundingModeSelect")?.addEventListener("change", () => {
  if ($("results")?.children.length) calcAll();
});
$("gradingPeriodSelect").addEventListener("change", updatePreviousGradeUI);
$("formsContainer").addEventListener("click", removeRow);
$("quizFormsContainer").addEventListener("click", removeRow);
updatePreviousGradeUI();
