export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "API key not configured on the server. Please check your environment variables.",
    });
  }

  const { stats, assessScores, quizScores, examScores } = req.body;
  if (!stats) {
    return res.status(400).json({ error: "Required grade data is missing" });
  }

  const prompt =
    `You are a helpful educational assistant. Provide a short, encouraging summary and insight of the following student grades: \n\n` +
    `Class Standing total: ${stats.classStanding}% (Assessments total weight: ${stats.assessment}%, Quizzes total weight: ${stats.quiz}%)\n` +
    `Raw Score Breakdown (Score/OutOf):\n` +
    `- Assessments: ${assessScores}\n` +
    `- Quizzes: ${quizScores}\n` +
    `- Exam: ${examScores}\n` +
    `Exam Total Percentage: ${stats.exam}%\n` +
    `Computed Grade: ${stats.computedGrade}%\n` +
    `Equivalent Grade: ${stats.equivalentGrade}\n\n` +
    `Provide constructive feedback in 1 SENTENCE MAXIMUM on what they can improve based on their raw scores. Do not use markdown. Address the student directly.\n` +
    `Make your tone more empathetic and encouraging. Avoid being too formal or robotic. Use a friendly and supportive tone.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini Error:", errorText);
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No summary generated.";

    return res.status(200).json({ summary: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "Failed to generate summary" });
  }
}
