const $ = (id) => document.getElementById(id);
let formCount = 1,
  quizFormCount = 1;
let parseTargetSection = "assessment";

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
const quantizeFinalToMode = (n) => {
  // Do not force-up final grade values; this avoids +0.01 inflation on decimals.
  return truncateTo2(n);
};
const fmt2 = (n) => {
  return quantizeToMode(n).toFixed(2);
};

const getEquivalentGrade = (percentage) => {
  const p = Number(percentage);
  if (Number.isNaN(p)) return null;

  if (p >= 99) return "1.00";
  if (p >= 96) return "1.25";
  if (p >= 93) return "1.50";
  if (p >= 90) return "1.75";
  if (p >= 87) return "2.00";
  if (p >= 84) return "2.25";
  if (p >= 81) return "2.50";
  if (p >= 78) return "2.75";
  if (p >= 75) return "3.00";
  return "5.00";
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
  if (Number.isNaN(score) || Number.isNaN(outOf) || outOf <= 0 || score < 0) {
    showErrorModal(
      "Invalid Exam Entries",
      "Exam Score must be a non-negative number and Exam Out Of must be greater than 0.",
    );
    return null;
  }

  if (score > outOf) {
    showErrorModal(
      "Invalid Exam Entries",
      "Exam Score is greater than Exam Out Of. This looks reversed. Please swap the values and try again.",
    );
    return null;
  }

  return quantizeToMode((score / outOf) * 50 + 50);
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
  if (!percentInput) {
    showErrorModal(
      `Missing ${section} Percentage`,
      `Please enter a percentage for ${section} before calculating.`,
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

  // If a section has no encoded rows, treat it as 0% even when percentage is blank.
  const percentRaw = percentInput.value.trim();
  const norm = percentRaw === "" && !vals.length ? 0 : normalize(percentRaw);
  if (norm === null) {
    showErrorModal(
      `Invalid ${section} Percentage`,
      `Please enter a valid percentage value for ${section}.`,
    );
    return null;
  }

  // Allow empty section rows when this section has 0% weight.
  if (norm === 0) {
    return { average: 0, partial: 0 };
  }

  if (!vals.length) {
    showErrorModal(
      `Missing ${section} Entries`,
      `Please fill at least one Score and Out Of pair for ${section}.`,
    );
    return null;
  }

  const parsedVals = [];
  for (const [index, v] of vals.entries()) {
    if (v.s === "" || v.o === "") {
      showErrorModal(
        `Incomplete ${section} Entry`,
        `${section} row ${index + 1} must have both Score and Out Of values.`,
      );
      return null;
    }

    const score = Number(v.s);
    const outOf = Number(v.o);

    if (Number.isNaN(score) || Number.isNaN(outOf) || outOf <= 0 || score < 0) {
      showErrorModal(
        `Invalid ${section} Entry`,
        `${section} row ${index + 1} must have a non-negative Score and an Out Of value greater than 0.`,
      );
      return null;
    }

    if (score > outOf) {
      showErrorModal(
        `Invalid ${section} Entry`,
        `${section} row ${index + 1} has Score greater than Out Of. This looks reversed. Please swap the values and try again.`,
      );
      return null;
    }

    parsedVals.push({ score, outOf });
  }

  // Match most LMS implementations: quantize each stage to 2 decimals.
  const percs = parsedVals.map((v) =>
    quantizeToMode((v.score / v.outOf) * 50 + 50),
  );
  const avg = quantizeToMode(percs.reduce((a, b) => a + b, 0) / percs.length);

  const partial = quantizeToMode(avg * norm);
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

  const classStanding = quantizeToMode(assess.partial + quiz.partial);

  const examPercentage = parseExamPercentage();
  if (examPercentage === null) return;
  const currentRaw = quantizeToMode(
    computeCurrentRaw(classStanding, examPercentage),
  );

  let computedGrade = quantizeFinalToMode(currentRaw);
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

    computedGrade = quantizeFinalToMode(
      computeTermGrade(selectedPeriod, currentRaw, previousGrade),
    );
  }
  const equivalentGrade = getEquivalentGrade(computedGrade);

  // create Bootstrap card element to show the result
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="card-body">Your class standing is <strong>${fmt2(classStanding)}%</strong> (${fmt2(assess.partial)}% from Assessment Tasks and ${fmt2(quiz.partial)}% from Quiz).${previousGrade === null ? "" : `<br>Using ${selectedPeriod === "midterm" ? "Prelim" : "Midterm"} grade <strong>${fmt2(previousGrade)}%</strong> your computed <b>${termLabels[selectedPeriod].toUpperCase()}</b> grade is <strong>${fmt2(computedGrade)}%</strong>.`}${previousGrade === null ? `<br>Your final grade for <b>PRELIM</b> is <strong>${fmt2(computedGrade)}%</strong>.` : ""}<br>Equivalent grade: <strong>${equivalentGrade}</strong>.</div>`;

  $("results").replaceChildren(card);
};

const clearAll = () => {
  // Keep the initial row for each section, remove only dynamically added rows.
  document.querySelectorAll(".assessment-row").forEach((row, index) => {
    if (index > 0) row.remove();
  });
  document.querySelectorAll(".quiz-row").forEach((row, index) => {
    if (index > 0) row.remove();
  });

  formCount = 1;
  quizFormCount = 1;

  document
    .querySelectorAll('input[type="number"]')
    .forEach((input) => (input.value = ""));

  if ($("gradingPeriodSelect")) $("gradingPeriodSelect").value = "prelim";
  if ($("roundingModeSelect")) $("roundingModeSelect").value = "round";

  $("results")?.replaceChildren();
  updatePreviousGradeUI();
};

const openParseModal = (section) => {
  const modalEl = $("parseRowsModal");
  const helpTextEl = $("parseRowsModalHelpText");
  const textInput = $("parseRowsTextInput");
  if (!modalEl || !helpTextEl || !textInput) return;

  parseTargetSection = section;
  helpTextEl.textContent =
    section === "assessment"
      ? "Paste Assessment rows here. We will extract No. of Items and Raw Score into Assessment fields."
      : "Paste Quiz rows here. We will extract No. of Items and Raw Score into Quiz fields.";
  textInput.value = "";
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

const ensureSectionRowCount = (section, count) => {
  const isQuiz = section === "quiz";
  const rowSelector = isQuiz ? ".quiz-row" : ".assessment-row";
  const rows = document.querySelectorAll(rowSelector);

  if (rows.length < count) {
    for (let i = rows.length; i < count; i += 1) {
      addForm(isQuiz);
    }
  }

  const updatedRows = Array.from(document.querySelectorAll(rowSelector));
  if (updatedRows.length > count) {
    updatedRows.slice(count).forEach((row) => row.remove());
  }
};

const applyParsedRowsToSection = (section, parsedRows) => {
  if (!Array.isArray(parsedRows) || !parsedRows.length) return;

  ensureSectionRowCount(section, parsedRows.length);

  const isQuiz = section === "quiz";
  const rowSelector = isQuiz ? ".quiz-row" : ".assessment-row";
  const scoreSelector = isQuiz ? ".quiz-score" : ".assessment-score";
  const outOfSelector = isQuiz ? ".quiz-outof" : ".assessment-outof";
  const rows = Array.from(document.querySelectorAll(rowSelector));

  parsedRows.forEach((entry, index) => {
    const row = rows[index];
    if (!row) return;
    const scoreInput = row.querySelector(scoreSelector);
    const outOfInput = row.querySelector(outOfSelector);
    if (scoreInput) scoreInput.value = entry.rawScore;
    if (outOfInput) outOfInput.value = entry.noOfItems;
  });
};

const onParseSubmit = () => {
  const textInput = $("parseRowsTextInput");
  const modalEl = $("parseRowsModal");
  if (!textInput || !modalEl) return;

  const rawText = textInput.value.trim();
  if (!rawText) {
    showErrorModal(
      "Empty Parse Input",
      "Please paste table rows before parsing.",
    );
    return;
  }

  const parsed = extractItemsAndRawScores(rawText);
  if (!parsed.rows.length) {
    showErrorModal(
      "No Rows Parsed",
      "No valid rows were found. Please paste the full copied rows from your table.",
    );
    return;
  }

  applyParsedRowsToSection(parseTargetSection, parsed.rows);
  bootstrap.Modal.getOrCreateInstance(modalEl).hide();
};

const extractItemsAndRawScores = (inputText) => {
  const rows = [];

  // Match each row block:
  // 1) row header line (starts with N) and any label text
  // 2) No. of Items
  // 3) Raw Score
  // 4) Percentage (captured but not returned)
  const rowPattern =
    /(\d+\)\s*[^\n]*\n\s*([0-9]+(?:\.[0-9]+)?)\s*\n\s*([0-9]+(?:\.[0-9]+)?)\s*\n\s*([0-9]+(?:\.[0-9]+)?))/g;

  let match;
  while ((match = rowPattern.exec(inputText)) !== null) {
    rows.push({
      noOfItems: Number(match[2]),
      rawScore: Number(match[3]),
    });
  }

  return {
    rows,
    noOfItems: rows.map((r) => r.noOfItems),
    rawScores: rows.map((r) => r.rawScore),
  };
};

$("addFormBtn").addEventListener("click", () => addForm(false));
$("addQuizFormBtn").addEventListener("click", () => addForm(true));
$("parseAssessmentBtn")?.addEventListener("click", () =>
  openParseModal("assessment"),
);
$("parseQuizBtn")?.addEventListener("click", () => openParseModal("quiz"));
$("parseRowsSubmitBtn")?.addEventListener("click", onParseSubmit);
$("calculateBtn").addEventListener("click", calcAll);
$("clearBtn")?.addEventListener("click", clearAll);
$("roundingModeSelect")?.addEventListener("change", () => {
  if ($("results")?.children.length) calcAll();
});
$("gradingPeriodSelect").addEventListener("change", updatePreviousGradeUI);
$("formsContainer").addEventListener("click", removeRow);
$("quizFormsContainer").addEventListener("click", removeRow);
updatePreviousGradeUI();
