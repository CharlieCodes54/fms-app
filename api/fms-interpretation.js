// api/fms-interpretation.js
// Vercel Node.js Serverless Function (CommonJS), manual JSON body parsing.

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper: read raw body from Vercel serverless request
async function readJsonBody(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    return JSON.parse(raw);
  } catch (err) {
    res.status(400).json({ error: "Invalid JSON body" });
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Parse body manually
  const fmsReport = await readJsonBody(req, res);
  if (!fmsReport) return;

  try {
    if (
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
- Do NOT provide medical diagnoses or claim to treat disease.
- Identify movement pattern issues, asymmetries, and training priorities.
- Flag any pain or zero scores for potential clinical referral.
- Stay strictly within fitness professional scope.

Return ONLY valid JSON with exactly this structure:
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
No extra keys. No text outside the JSON.
`;

    const userPrompt = `FMS report JSON:\n${JSON.stringify(
      fmsReport,
      null,
      2
    )}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
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
    } catch {
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

    // Enforce schema
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
      if (!Array.isArray(tr.specific_interventions))
        tr.specific_interventions = [];
      if (!Array.isArray(tr.refer_out_flags))
        tr.refer_out_flags = [];
    }

    res.status(200).json(parsed);
  } catch (error) {
    console.error("FMS interpretation error:", error);
    res.status(500).json({ error: "Server or OpenAI error" });
  }
};
