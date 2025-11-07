// api/fms-interpretation.js
// Vercel serverless function (Node.js, CommonJS style)

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const fmsReport = req.body;

    if (
      !fmsReport ||
      typeof fmsReport !== "object" ||
      !fmsReport.tests ||
      !fmsReport.derived
    ) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const systemPrompt = `
You are an expert strength & conditioning and movement professional.
Interpret the Functional Movement Screen (FMS) JSON for personal trainers.

Constraints:
- Use ONLY the data provided.
- No medical diagnoses or treatment claims.
- Identify movement pattern issues, asymmetries, and training priorities.
- Flag any pain or zero scores for possible clinical referral.
- Stay within fitness scope: mobility, stability, patterning, regressions, progressions, load guidelines.
- Be concise and practical.

Return ONLY valid JSON with this structure:
{
  "summary": string,
  "movement_dysfunctions": [
    {
      "pattern": string,
      "findings": string[],
      "implications": string[]
    }
  ],
  "priority_issues": string[],
  "training_recommendations": {
    "phase_1_focus": string[],
    "phase_2_focus": string[],
    "specific_interventions": [
      {
        "goal": string,
        "strategies": string[]
      }
    ],
    "refer_out_flags": string[]
  }
}
No extra keys. No prose outside the JSON.
`;

    const userPrompt = `FMS report JSON:\n${JSON.stringify(
      fmsReport,
      null,
      2
    )}`;

    const completion = await client.chat.completions.create({
      model: "gpt-5",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = {
        summary: "Unable to parse structured AI output.",
        movement_dysfunctions: [],
        priority_issues: [],
        training_recommendations: {
          phase_1_focus: [],
          phase_2_focus: [],
          specific_interventions: [],
          refer_out_flags: [],
        },
      };
    }

    // Defensive shape enforcement
    if (typeof parsed.summary !== "string") parsed.summary = "";
    if (!Array.isArray(parsed.movement_dysfunctions))
      parsed.movement_dysfunctions = [];
    if (!Array.isArray(parsed.priority_issues))
      parsed.priority_issues = [];
    if (typeof parsed.training_recommendations !== "object") {
      parsed.training_recommendations = {
        phase_1_focus: [],
        phase_2_focus: [],
        specific_interventions: [],
        refer_out_flags: [],
      };
    } else {
      const tr = parsed.training_recommendations;
      if (!Array.isArray(tr.phase_1_focus)) tr.phase_1_focus = [];
      if (!Array.isArray(tr.phase_2_focus)) tr.phase_2_focus = [];
