const formsContainer = document.getElementById("formsContainer");
const addFormBtn = document.getElementById("addFormBtn");
const quizFormsContainer = document.getElementById("quizFormsContainer");
const addQuizFormBtn = document.getElementById("addQuizFormBtn");
const calculateBtn = document.getElementById("calculateBtn");
const appErrorModalElement = document.getElementById("appErrorModal");
const appErrorModalLabel = document.getElementById("appErrorModalLabel");
const appErrorModalBody = document.getElementById("appErrorModalBody");
let formCount = 1;
let quizFormCount = 1;

function showErrorModal(title, content) {
  if (!appErrorModalElement || !appErrorModalLabel || !appErrorModalBody) {
    console.error("Error modal elements are missing in the HTML.");
    return;
  }

  appErrorModalLabel.textContent = title;
  appErrorModalBody.textContent = content;

  const modalInstance =
    bootstrap.Modal.getOrCreateInstance(appErrorModalElement);
  modalInstance.show();
}

window.showErrorModal = showErrorModal;

function normalizePercentageValue(rawValue) {
  const parsed = Number(rawValue);

  if (Number.isNaN(parsed)) {
    return null;
  }

  if (parsed > 1) {
    return parsed / 100;
  }

  return parsed;
}

function addAssessmentForm() {
  formCount += 1;

  const formField = document.createElement("div");
  formField.className = "assessment-row row g-3 mb-3";

  formField.innerHTML = `
    <div class="col-md-6">
      <div class="form-floating">
        <input
          type="number"
          class="form-control assessment-score"
          id="scoreInput${formCount}"
          placeholder="0"
        />
        <label for="scoreInput${formCount}">Assessment Task Score</label>
      </div>
    </div>
    <div class="col-md-6">
      <div class="form-floating">
        <input
          type="number"
          class="form-control assessment-outof"
          id="outOfInput${formCount}"
          placeholder="0"
        />
        <label for="outOfInput${formCount}">Out Of</label>
      </div>
    </div>
  `;

  formsContainer.appendChild(formField);
}

function addQuizForm() {
  quizFormCount += 1;

  const formField = document.createElement("div");
  formField.className = "quiz-row row g-3 mb-3";

  formField.innerHTML = `
    <div class="col-md-6">
      <div class="form-floating">
        <input
          type="number"
          class="form-control quiz-score"
          id="quizScoreInput${quizFormCount}"
          placeholder="0"
        />
        <label for="quizScoreInput${quizFormCount}">Score</label>
      </div>
    </div>
    <div class="col-md-6">
      <div class="form-floating">
        <input
          type="number"
          class="form-control quiz-outof"
          id="quizOutOfInput${quizFormCount}"
          placeholder="0"
        />
        <label for="quizOutOfInput${quizFormCount}">Out Of</label>
      </div>
    </div>
  `;

  quizFormsContainer.appendChild(formField);
}

function calculateSection({
  sectionName,
  container,
  percentageSelector,
  rowSelector,
  scoreSelector,
  outOfSelector,
}) {
  const percentageInput = container.querySelector(percentageSelector);
  const rows = container.querySelectorAll(rowSelector);
  const values = [];
  const percentages = [];
  let normalizedPercentage = null;

  if (percentageInput && percentageInput.value.trim() !== "") {
    normalizedPercentage = normalizePercentageValue(
      percentageInput.value.trim(),
    );

    if (normalizedPercentage === null) {
      showErrorModal(
        `Invalid ${sectionName} Percentage`,
        `Please enter a valid percentage value for ${sectionName}.`,
      );
      return null;
    }

    console.log(
      `${sectionName} percentage (normalized): ${normalizedPercentage}`,
    );
  } else {
    showErrorModal(
      `Missing ${sectionName} Percentage`,
      `Please enter a percentage for ${sectionName} before calculating.`,
    );
    return null;
  }

  rows.forEach((row, index) => {
    const scoreInput = row.querySelector(scoreSelector);
    const outOfInput = row.querySelector(outOfSelector);

    if (!scoreInput || !outOfInput) {
      return;
    }

    const score = scoreInput.value.trim();
    const outOf = outOfInput.value.trim();

    if (score !== "" || outOf !== "") {
      values.push({
        task: index + 1,
        score,
        outOf,
      });
    }
  });

  if (values.length === 0) {
    showErrorModal(
      `Missing ${sectionName} Entries`,
      `Please fill at least one Score and Out Of pair for ${sectionName}.`,
    );
    return null;
  }

  for (const item of values) {
    const rawCalculation = (Number(item.score) / Number(item.outOf)) * 50 + 50;
    const calculation = Number(rawCalculation.toFixed(2));
    percentages.push(calculation);
  }

  const total = percentages.reduce(
    (totalValue, value) => totalValue + value,
    0,
  );
  const average = Number((total / percentages.length).toFixed(2));
  const partial = Number((average * normalizedPercentage).toFixed(2));

  console.log(`${sectionName} average: ${average}`);
  console.log(`${sectionName} partial: ${partial}`);

  return {
    average,
    partial,
  };
}

function calculateAndPrintFields() {
  const assessmentResult = calculateSection({
    sectionName: "Assessment Tasks",
    container: formsContainer,
    percentageSelector: "#floatingInput",
    rowSelector: ".assessment-row",
    scoreSelector: ".assessment-score",
    outOfSelector: ".assessment-outof",
  });

  if (!assessmentResult) {
    return;
  }

  const quizResult = calculateSection({
    sectionName: "Quiz",
    container: quizFormsContainer,
    percentageSelector: "#floatingQuizInput",
    rowSelector: ".quiz-row",
    scoreSelector: ".quiz-score",
    outOfSelector: ".quiz-outof",
  });

  if (!quizResult) {
    return;
  }
}

addFormBtn.addEventListener("click", addAssessmentForm);
addQuizFormBtn.addEventListener("click", addQuizForm);
calculateBtn.addEventListener("click", calculateAndPrintFields);
