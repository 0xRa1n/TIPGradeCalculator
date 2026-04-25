const $ = (id) => document.getElementById(id);
let formCount = 1,
  quizFormCount = 1,
  examFormCount = 1,
  mergeComponentFormCount = 1;
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

const roundTo2 = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return num;

  // Stabilize floating-point representation before half-up rounding.
  const normalized = Number(num.toFixed(10));
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
};

const truncateTo2 = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return num;
  return Math.trunc(num * 100) / 100;
};

const fmt2 = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return roundTo2(num).toFixed(2);
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
  if (period === "prelim") return truncateTo2(currentRaw);

  // Midterm/Final: 1/3 of previous period grade + 2/3 of current period raw.
  const prevPart = truncateTo2(previousGrade / 3);
  const currentPart = truncateTo2((2 * currentRaw) / 3);
  return truncateTo2(prevPart + currentPart);
};

const computeCurrentRaw = (classStanding, examPercentage) => {
  // Raw grade inside a period is always 50% exam + 50% class standing.
  const examPart = roundTo2(0.5 * examPercentage);
  const standingPart = roundTo2(0.5 * classStanding);
  return roundTo2(examPart + standingPart);
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

const updateExamInputModeUI = () => {
  const modeSelect = $("examInputModeSelect");
  const directWrap = $("examDirectWrap");
  if (!modeSelect || !directWrap) return;

  if (modeSelect.value === "direct") {
    directWrap.classList.remove("d-none");
  } else {
    directWrap.classList.add("d-none");
  }
};

const updateClassStandingInputModeUI = () => {
  const modeSelect = $("classStandingInputModeSelect");
  const directWrap = $("classStandingDirectWrap");
  if (!modeSelect || !directWrap) return;

  if (modeSelect.value === "direct") {
    directWrap.classList.remove("d-none");
  } else {
    directWrap.classList.add("d-none");
  }
};

const parseExamPercentage = () => {
  const mode = $("examInputModeSelect")?.value || "auto";
  if (mode === "direct") {
    const directInput = $("examDirectPercentageInput")?.value.trim() || "";
    if (!directInput) {
      showErrorModal(
        "Missing LMS Exam Percentage",
        "Please enter the LMS Exam Percentage value.",
      );
      return null;
    }

    const directValue = Number(directInput);
    if (Number.isNaN(directValue) || directValue < 0 || directValue > 100) {
      showErrorModal(
        "Invalid LMS Exam Percentage",
        "LMS Exam Percentage must be a number between 0 and 100.",
      );
      return null;
    }

    return roundTo2(directValue);
  }

  const rows = Array.from(document.querySelectorAll(".exam-row"));
  const vals = rows
    .map((row) => {
      const score = row.querySelector(".exam-score")?.value.trim() || "";
      const outOf = row.querySelector(".exam-outof")?.value.trim() || "";
      const weight = row.querySelector(".exam-weight")?.value.trim() || "";
      return score !== "" || outOf !== "" || weight !== ""
        ? { score, outOf, weight }
        : null;
    })
    .filter(Boolean);

  if (!vals.length) {
    showErrorModal(
      "Missing Exam Entries",
      "Please enter at least one Exam Score and Exam Out Of pair.",
    );
    return null;
  }

  const parsedVals = [];
  for (const [index, v] of vals.entries()) {
    if (v.score === "" || v.outOf === "") {
      showErrorModal(
        "Incomplete Exam Entry",
        `Exam row ${index + 1} must have both Score and Out Of values.`,
      );
      return null;
    }

    const score = Number(v.score);
    const outOf = Number(v.outOf);

    if (Number.isNaN(score) || Number.isNaN(outOf) || outOf <= 0 || score < 0) {
      showErrorModal(
        "Invalid Exam Entries",
        `Exam row ${index + 1} must have a non-negative Score and an Out Of value greater than 0.`,
      );
      return null;
    }

    if (score > outOf) {
      showErrorModal(
        "Invalid Exam Entries",
        `Exam row ${index + 1} has Score greater than Out Of. This looks reversed. Please swap the values and try again.`,
      );
      return null;
    }

    let weight = null;
    if (v.weight !== "") {
      weight = Number(v.weight);
      if (Number.isNaN(weight) || weight < 0) {
        showErrorModal(
          "Invalid Exam Weight",
          `Exam row ${index + 1} must have a valid non-negative weight percentage.`,
        );
        return null;
      }
    }

    parsedVals.push({ score, outOf, weight });
  }

  const hasAnyWeight = parsedVals.some((entry) => entry.weight !== null);

  if (hasAnyWeight) {
    const hasMissingWeight = parsedVals.some((entry) => entry.weight === null);
    if (hasMissingWeight) {
      showErrorModal(
        "Missing Exam Weights",
        "When using Exam component weights, every filled exam row must include a Weight (%).",
      );
      return null;
    }

    const totalWeight = roundTo2(
      parsedVals.reduce((sum, entry) => sum + entry.weight, 0),
    );

    if (Math.abs(totalWeight - 100) > 0.01) {
      showErrorModal(
        "Invalid Exam Weights",
        `Exam weights must add up to 100%. Current total is ${fmt2(totalWeight)}%.`,
      );
      return null;
    }

    const weighted = parsedVals.reduce((sum, entry) => {
      const transmuted = roundTo2((entry.score / entry.outOf) * 50 + 50);
      const contribution = roundTo2(transmuted * (entry.weight / 100));
      return roundTo2(sum + contribution);
    }, 0);

    return roundTo2(weighted);
  }

  const totalScore = parsedVals.reduce((sum, entry) => sum + entry.score, 0);
  const totalOutOf = parsedVals.reduce((sum, entry) => sum + entry.outOf, 0);
  return roundTo2((totalScore / totalOutOf) * 50 + 50);
};

const addExamForm = () => {
  const c = ++examFormCount;
  const container = $("examFormsContainer");
  const html = `
    <div class="exam-row row g-3 mb-3 position-relative">
      <div class="col-md-4">
        <div class="form-floating">
          <input type="number" class="form-control exam-score" id="examScoreInput${c}" placeholder="0"/>
          <label for="examScoreInput${c}">Score</label>
        </div>
      </div>
      <div class="col-md-4">
        <div class="form-floating">
          <input type="number" class="form-control exam-outof" id="examOutOfInput${c}" placeholder="0"/>
          <label for="examOutOfInput${c}">Out Of</label>
        </div>
      </div>
      <div class="col-md-4 d-flex align-items-center gap-2">
        <div class="form-floating flex-grow-1">
          <input type="number" class="form-control exam-weight" id="examWeightInput${c}" placeholder="0"/>
          <label for="examWeightInput${c}">Weight (%) Optional</label>
        </div>
        <button
          type="button"
          class="remove-row-btn btn btn-link text-danger text-decoration-none p-0"
          aria-label="Remove exam entry"
          style="font-size:1rem;line-height:1;"
        >
          X
        </button>
      </div>
    </div>`;
  container.insertAdjacentHTML("beforeend", html);
};

const addMergeComponentForm = () => {
  const c = ++mergeComponentFormCount;
  const container = $("mergeComponentsContainer");
  const html = `
    <div class="merge-component-row row g-3 mb-3 position-relative">
      <div class="col-md-6">
        <div class="form-floating">
          <input type="number" class="form-control merge-component-percentage" id="mergeComponentPercentageInput${c}" placeholder="0"/>
          <label for="mergeComponentPercentageInput${c}">Component Percentage</label>
        </div>
      </div>
      <div class="col-md-6 d-flex align-items-center gap-2">
        <div class="form-floating flex-grow-1">
          <input type="number" class="form-control merge-component-weight" id="mergeComponentWeightInput${c}" placeholder="0"/>
          <label for="mergeComponentWeightInput${c}">Component Weight (%)</label>
        </div>
        <button
          type="button"
          class="remove-row-btn btn btn-link text-danger text-decoration-none p-0"
          aria-label="Remove merge component entry"
          style="font-size:1rem;line-height:1;"
        >
          X
        </button>
      </div>
    </div>`;
  container.insertAdjacentHTML("beforeend", html);
};

const getMergedAssessmentFromComponents = () => {
  const rows = Array.from(document.querySelectorAll(".merge-component-row"));
  const vals = rows
    .map((row) => {
      const percentage =
        row.querySelector(".merge-component-percentage")?.value.trim() || "";
      const weight =
        row.querySelector(".merge-component-weight")?.value.trim() || "";
      return percentage !== "" || weight !== "" ? { percentage, weight } : null;
    })
    .filter(Boolean);

  if (!vals.length) {
    showErrorModal(
      "Missing Merge Entries",
      "Please enter at least one Component Percentage and Weight pair.",
    );
    return null;
  }

  const parsedVals = [];
  for (const [index, v] of vals.entries()) {
    if (v.percentage === "" || v.weight === "") {
      showErrorModal(
        "Incomplete Merge Entry",
        `Merge row ${index + 1} must have both Component Percentage and Weight values.`,
      );
      return null;
    }

    const percentage = Number(v.percentage);
    const weight = Number(v.weight);

    if (
      Number.isNaN(percentage) ||
      Number.isNaN(weight) ||
      percentage < 0 ||
      percentage > 100 ||
      weight <= 0
    ) {
      showErrorModal(
        "Invalid Merge Entry",
        `Merge row ${index + 1} must have Percentage between 0 and 100 and Weight greater than 0.`,
      );
      return null;
    }

    parsedVals.push({ percentage, weight });
  }

  const totalWeight = roundTo2(
    parsedVals.reduce((sum, entry) => sum + entry.weight, 0),
  );

  const weightedPercentage = roundTo2(
    parsedVals.reduce(
      (sum, entry) => sum + entry.percentage * entry.weight,
      0,
    ) / totalWeight,
  );

  // Grade transmutation in this tool maps raw 0-100 to percentage 50-100.
  // Convert target merged percentage back to a synthetic raw score over 100.
  const syntheticScore = roundTo2((weightedPercentage - 50) * 2);
  if (syntheticScore < 0 || syntheticScore > 100) {
    showErrorModal(
      "Unsupported Merge Result",
      "Merged percentage is outside the supported transmutation range (50 to 100).",
    );
    return null;
  }

  return {
    totalWeight,
    weightedPercentage,
    syntheticScore,
    syntheticOutOf: 100,
  };
};

const applyMergedAssessment = () => {
  const merged = getMergedAssessmentFromComponents();
  if (!merged) return;

  if ($("floatingInput")) $("floatingInput").value = String(merged.totalWeight);

  document.querySelectorAll(".assessment-row").forEach((row, index) => {
    if (index > 0) row.remove();
  });
  formCount = 1;

  const scoreInput = document.querySelector(
    ".assessment-row .assessment-score",
  );
  const outOfInput = document.querySelector(
    ".assessment-row .assessment-outof",
  );
  if (scoreInput) scoreInput.value = String(merged.syntheticScore);
  if (outOfInput) outOfInput.value = String(merged.syntheticOutOf);

  if ($("mergeHelperResult")) {
    $("mergeHelperResult").textContent =
      `Applied merged Assessment: ${fmt2(merged.weightedPercentage)}% at ${fmt2(merged.totalWeight)}% weight (synthetic row ${fmt2(merged.syntheticScore)}/${fmt2(merged.syntheticOutOf)}).`;
  }
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

  const row = btn.closest(
    ".assessment-row, .quiz-row, .exam-row, .merge-component-row",
  );
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

  const percs = parsedVals.map((v) => roundTo2((v.score / v.outOf) * 50 + 50));
  const sumCents = percs.reduce((sum, val) => sum + Math.round(val * 100), 0);
  const avg = roundTo2(sumCents / percs.length / 100);

  const partial = roundTo2(avg * norm);
  return {
    average: avg,
    partial,
  };
};

const calcAll = () => {
  const selectedPeriod = $("gradingPeriodSelect")?.value || "prelim";

  const classStandingMode = $("classStandingInputModeSelect")?.value || "auto";

  let assess = { partial: 0 };
  let quiz = { partial: 0 };
  let autoClassStanding = 0;

  if (classStandingMode === "auto") {
    assess = calcSection({
      section: "Assessment Tasks",
      container: $("formsContainer"),
      percentSel: "#floatingInput",
      rowSel: ".assessment-row",
      scoreSel: ".assessment-score",
      outOfSel: ".assessment-outof",
    });
    if (!assess) return;
    quiz = calcSection({
      section: "Quiz",
      container: $("quizFormsContainer"),
      percentSel: "#floatingQuizInput",
      rowSel: ".quiz-row",
      scoreSel: ".quiz-score",
      outOfSel: ".quiz-outof",
    });
    if (!quiz) return;

    autoClassStanding = roundTo2(assess.partial + quiz.partial);
  }

  const directClassStandingInput =
    $("classStandingDirectInput")?.value.trim() || "";

  let classStanding = classStandingMode === "auto" ? autoClassStanding : 0;
  let usedClassStandingOverride = false;

  if (classStandingMode === "direct") {
    if (directClassStandingInput === "") {
      showErrorModal(
        "Missing LMS Class Standing",
        "Please enter the LMS Class Standing % value.",
      );
      return;
    }

    const directClassStanding = Number(directClassStandingInput);
    if (
      Number.isNaN(directClassStanding) ||
      directClassStanding < 0 ||
      directClassStanding > 100
    ) {
      showErrorModal(
        "Invalid LMS Class Standing",
        "LMS Class Standing % must be a number between 0 and 100.",
      );
      return;
    }

    classStanding = roundTo2(directClassStanding);
    usedClassStandingOverride = true;
  } else if (directClassStandingInput !== "") {
    const directClassStanding = Number(directClassStandingInput);
    if (!Number.isNaN(directClassStanding)) {
      classStanding = roundTo2(directClassStanding);
      usedClassStandingOverride = true;
    }
  }

  const examPercentage = parseExamPercentage();
  if (examPercentage === null) return;

  const currentRaw = roundTo2(computeCurrentRaw(classStanding, examPercentage));

  let computedGrade = truncateTo2(currentRaw);
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

    computedGrade = truncateTo2(
      computeTermGrade(selectedPeriod, currentRaw, previousGrade),
    );
  }
  const equivalentGrade = getEquivalentGrade(computedGrade);

  // create Bootstrap card element to show the result
  const card = document.createElement("div");
  card.className = "card";
  const classStandingText = usedClassStandingOverride
    ? `Your class standing is <strong>${fmt2(classStanding)}%</strong> (using LMS Class Standing override).`
    : `Your class standing is <strong>${fmt2(classStanding)}%</strong> (${fmt2(assess.partial)}% from Assessment Tasks and ${fmt2(quiz.partial)}% from Quiz).`;
  card.innerHTML = `<div class="card-body">${classStandingText}${previousGrade === null ? "" : `<br>Using ${selectedPeriod === "midterm" ? "Prelim" : "Midterm"} grade <strong>${fmt2(previousGrade)}%</strong> your computed <b>${termLabels[selectedPeriod].toUpperCase()}</b> grade is <strong>${fmt2(computedGrade)}%</strong>.`}${previousGrade === null ? `<br>Your final grade for <b>PRELIM</b> is <strong>${fmt2(computedGrade)}%</strong>.` : ""}<br>Equivalent grade: <strong>${equivalentGrade}</strong>.</div>`;

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
  document.querySelectorAll(".exam-row").forEach((row, index) => {
    if (index > 0) row.remove();
  });
  document.querySelectorAll(".merge-component-row").forEach((row, index) => {
    if (index > 0) row.remove();
  });

  formCount = 1;
  quizFormCount = 1;
  examFormCount = 1;
  mergeComponentFormCount = 1;

  document
    .querySelectorAll('input[type="number"]')
    .forEach((input) => (input.value = ""));

  if ($("gradingPeriodSelect")) $("gradingPeriodSelect").value = "prelim";
  if ($("classStandingInputModeSelect")) {
    $("classStandingInputModeSelect").value = "auto";
  }
  if ($("examInputModeSelect")) $("examInputModeSelect").value = "auto";
  updateClassStandingInputModeUI();
  updateExamInputModeUI();
  if ($("mergeHelperResult")) $("mergeHelperResult").textContent = "";

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
      : section === "quiz"
        ? "Paste Quiz rows here. We will extract No. of Items and Raw Score into Quiz fields."
        : "Paste component summary rows here (e.g. Component @35.00% ... 90.00). We will extract Component Percentage and Component Weight into Merge Components Helper.";
  textInput.value = "";
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

const ensureSectionAdditionalRows = (section, additionalCount) => {
  const isQuiz = section === "quiz";
  const rowSelector = isQuiz ? ".quiz-row" : ".assessment-row";
  for (let i = 0; i < additionalCount; i += 1) {
    addForm(isQuiz);
  }
};

const applyParsedRowsToSection = (section, parsedRows) => {
  if (!Array.isArray(parsedRows) || !parsedRows.length) return;

  const isQuiz = section === "quiz";
  const rowSelector = isQuiz ? ".quiz-row" : ".assessment-row";
  const scoreSelector = isQuiz ? ".quiz-score" : ".assessment-score";
  const outOfSelector = isQuiz ? ".quiz-outof" : ".assessment-outof";
  const existingRows = Array.from(document.querySelectorAll(rowSelector));
  let startIndex = existingRows.findIndex((row) => {
    const scoreVal = row.querySelector(scoreSelector)?.value.trim() || "";
    const outOfVal = row.querySelector(outOfSelector)?.value.trim() || "";
    return scoreVal === "" && outOfVal === "";
  });

  if (startIndex === -1) {
    startIndex = existingRows.length;
  }

  const neededRows = startIndex + parsedRows.length;
  const additionalCount = Math.max(0, neededRows - existingRows.length);
  ensureSectionAdditionalRows(section, additionalCount);

  const rows = Array.from(document.querySelectorAll(rowSelector));

  parsedRows.forEach((entry, index) => {
    const row = rows[startIndex + index];
    if (!row) return;
    const scoreInput = row.querySelector(scoreSelector);
    const outOfInput = row.querySelector(outOfSelector);
    if (scoreInput) scoreInput.value = entry.rawScore;
    if (outOfInput) outOfInput.value = entry.noOfItems;
  });
};

const ensureMergeComponentAdditionalRows = (additionalCount) => {
  for (let i = 0; i < additionalCount; i += 1) {
    addMergeComponentForm();
  }
};

const applyParsedMergeComponents = (parsedRows) => {
  if (!Array.isArray(parsedRows) || !parsedRows.length) return;

  const rowSelector = ".merge-component-row";
  const existingRows = Array.from(document.querySelectorAll(rowSelector));
  let startIndex = existingRows.findIndex((row) => {
    const percentageVal =
      row.querySelector(".merge-component-percentage")?.value.trim() || "";
    const weightVal =
      row.querySelector(".merge-component-weight")?.value.trim() || "";
    return percentageVal === "" && weightVal === "";
  });

  if (startIndex === -1) {
    startIndex = existingRows.length;
  }

  const neededRows = startIndex + parsedRows.length;
  const additionalCount = Math.max(0, neededRows - existingRows.length);
  ensureMergeComponentAdditionalRows(additionalCount);

  const rows = Array.from(document.querySelectorAll(rowSelector));
  parsedRows.forEach((entry, index) => {
    const row = rows[startIndex + index];
    if (!row) return;
    const percentageInput = row.querySelector(".merge-component-percentage");
    const weightInput = row.querySelector(".merge-component-weight");
    if (percentageInput) percentageInput.value = entry.componentPercentage;
    if (weightInput) weightInput.value = entry.componentWeight;
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

  if (parseTargetSection === "merge") {
    const parsedMerge = extractMergedComponentSummary(rawText);
    if (!parsedMerge.rows.length) {
      showErrorModal(
        "No Rows Parsed",
        "No valid component summary rows were found. Please paste rows that include values like '@35.00%' and the component percentage (e.g. 90.00).",
      );
      return;
    }
    applyParsedMergeComponents(parsedMerge.rows);
  } else {
    const parsed = extractItemsAndRawScores(rawText);
    if (!parsed.rows.length) {
      showErrorModal(
        "No Rows Parsed",
        "No valid rows were found. Please paste the full copied rows from your table.",
      );
      return;
    }

    applyParsedRowsToSection(parseTargetSection, parsed.rows);
  }
  bootstrap.Modal.getOrCreateInstance(modalEl).hide();
};

const extractMergedComponentSummary = (inputText) => {
  const rows = [];
  const lines = inputText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || !line.includes("@") || !line.includes("%")) continue;

    const weightMatch = line.match(/@\s*([0-9]+(?:\.[0-9]+)?)\s*%/);
    if (!weightMatch) continue;

    const componentWeight = Number(weightMatch[1]);
    if (!Number.isFinite(componentWeight) || componentWeight <= 0) continue;

    let componentPercentage = null;

    const afterWeightText = line.slice(
      (weightMatch.index || 0) + weightMatch[0].length,
    );
    const numbersAfterWeight = afterWeightText.match(/[0-9]+(?:\.[0-9]+)?/g);
    if (numbersAfterWeight?.length) {
      componentPercentage = Number(
        numbersAfterWeight[numbersAfterWeight.length - 1],
      );
    } else {
      const nextLine = lines[i + 1]?.trim() || "";
      if (/^[0-9]+(?:\.[0-9]+)?$/.test(nextLine)) {
        componentPercentage = Number(nextLine);
      }
    }

    if (
      Number.isFinite(componentPercentage) &&
      componentPercentage >= 0 &&
      componentPercentage <= 100
    ) {
      rows.push({
        componentPercentage: roundTo2(componentPercentage),
        componentWeight: roundTo2(componentWeight),
      });
    }
  }

  return { rows };
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
$("addExamFormBtn")?.addEventListener("click", addExamForm);
$("addMergeComponentBtn")?.addEventListener("click", addMergeComponentForm);
$("applyMergedAssessmentBtn")?.addEventListener("click", applyMergedAssessment);
$("parseMergeComponentsBtn")?.addEventListener("click", () =>
  openParseModal("merge"),
);
$("parseAssessmentBtn")?.addEventListener("click", () =>
  openParseModal("assessment"),
);
$("parseQuizBtn")?.addEventListener("click", () => openParseModal("quiz"));
$("parseRowsSubmitBtn")?.addEventListener("click", onParseSubmit);
$("calculateBtn").addEventListener("click", calcAll);
$("clearBtn")?.addEventListener("click", clearAll);
$("gradingPeriodSelect").addEventListener("change", updatePreviousGradeUI);
$("classStandingInputModeSelect")?.addEventListener(
  "change",
  updateClassStandingInputModeUI,
);
$("examInputModeSelect")?.addEventListener("change", updateExamInputModeUI);
$("formsContainer").addEventListener("click", removeRow);
$("quizFormsContainer").addEventListener("click", removeRow);
$("examFormsContainer")?.addEventListener("click", removeRow);
$("mergeComponentsContainer")?.addEventListener("click", removeRow);
updatePreviousGradeUI();
updateClassStandingInputModeUI();
updateExamInputModeUI();
