import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const fmsReport = req.body;

    if (!fmsReport || typeof fmsReport !== "object" || !fmsReport.tests || !fmsReport.derived) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const systemPrompt = `
You are an expert strength & conditioning and movement professional.
You interpret Functional Movement Screen (FMS) results for personal trainers.

Rules:
- Use ONLY the data provided in the JSON payload.
- Do NOT provide medical diagnoses or claim to treat disease.
- Identify movement patterns, limitations, asymmetries, and training priorities.
- Explicitly flag any pain or zero scores as reasons for clinical/medical referral.
- Stay within fitness professional scope: mobility, stability, patterning, regressions/progressions, loading guidelines.
- Conservative, FMS-consistent, no hype.

Return ONLY JSON with this exact structure:
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
No extra keys. No text outside JSON.
`;

    const userPrompt = `
FMS report JSON:
${JSON.stringify(fmsReport, null, 2)}

Generate the structured JSON response now.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-5", // check your dashboard for current recommended model
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
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
          refer_out_flags: []
        }
      };
    }

    // enforce shape defensively
    if (typeof parsed.summary !== "string") parsed.summary = "";
    if (!Array.isArray(parsed.movement_dysfunctions)) parsed.movement_dysfunctions = [];
    if (!Array.isArray(parsed.priority_issues)) parsed.priority_issues = [];
    if (typeof parsed.training_recommendations !== "object") {
      parsed.training_recommendations = {
        phase_1_focus: [],
        phase_2_focus: [],
        specific_interventions: [],
        refer_out_flags: []
      };
    } else {
      const tr = parsed.training_recommendations;
      if (!Array.isArray(tr.phase_1_focus)) tr.phase_1_focus = [];
      if (!Array.isArray(tr.phase_2_focus)) tr.phase_2_focus = [];
      if (!Array.isArray(tr.specific_interventions)) tr.specific_interventions = [];
      if (!Array.isArray(tr.refer_out_flags)) tr.refer_out_flags = [];
    }

    res.status(200).json(parsed);
  } catch (error) {
    console.error("FMS interpretation error:", error);
    res.status(500).json({ error: "Server or OpenAI error" });
  }
}
