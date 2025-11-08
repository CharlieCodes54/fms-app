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
const systemPrompt = `
You are an expert strength & conditioning coach.
Interpret Functional Movement Screen (FMS) data for a personal trainer.

Audience:
- Primary: trainer who needs to scan results in under 30 seconds.
- Secondary: client: needs a short, calm, plain-language explanation the trainer can read aloud.

Scope:
- Use ONLY the provided FMS JSON.
- No medical diagnosis. No talk of "treating" pain or disease.
- You may say "consider medical or clinical review" when pain (0 score or clearing test) or red flags appear.
- Focus on: movement quality, asymmetries, mobility/stability, prioritization, and clear training direction.

Formatting requirements (STRICT):
- Return ONLY valid JSON with EXACTLY this structure:

{
  "summary": string,
  "movement_dysfunctions": [
    {
      "pattern": string,
      "key_points": string[],
      "implications": string[]
    }
  ],
  "priority_issues": string[],
  "training_recommendations": {
    "contraindications": string[],
    "goals": string[],
    "implementation_strategy": string[],
    "phase_1_focus": string[],
    "phase_2_focus": string[],
    "specific_interventions": [
      {
        "goal": string,
        "strategies": string[]
      }
    ],
    "refer_out_flags": string[]
  },
  "client_summary": string
}

Section rules:

1) summary
- 2–3 sentences MAX.
- Plain, direct overview: overall movement quality, presence/absence of pain, and 1–2 key themes.
- No bullet points here.

2) movement_dysfunctions
- 3–6 entries MAX.
- Each "pattern" = short label (e.g. "Deep Squat", "Inline Lunge", "Shoulder Mobility").
- key_points:
  - 2–3 bullets per pattern.
  - Each bullet ≤ 14 words.
  - Describe only the most important observable issues (asymmetry, instability, limited ROM).
- implications:
  - 1–2 bullets per pattern.
  - Each bullet ≤ 16 words.
  - Focus on what this means for training: loading tolerance, control demands, efficiency, risk trend.
- Do NOT restate the entire FMS manual.

3) priority_issues
- 3–5 bullets.
- Ordered highest priority → lowest.
- Each bullet ≤ 14 words.
- Combine related findings (e.g. "Unilateral hip and ankle control deficits affecting squat, hurdle step, and lunge").

4) training_recommendations
- Overall: concise, modular, easy to skim.
- contraindications:
  - 0–5 bullets.
  - Only include clear "be cautious with..." programming notes.
- goals:
  - 3–6 bullets.
  - Clear capability goals (e.g. "Stable single-leg stance for 20+ seconds each side").
- implementation_strategy:
  - 3–6 bullets.
  - High-level plan (e.g. "Open sessions with ankle/hip mobility before loaded squats").
- phase_1_focus:
  - 2–5 bullets.
  - Correctives / regressions / patterning emphasis (first 4–6 weeks).
- phase_2_focus:
  - 2–5 bullets.
  - Integration: loaded patterns, power, work capacity once basics improve.
- specific_interventions:
  - 2–4 objects MAX.
  - Each:
    - goal: short label.
    - strategies: 2–3 bullets, each ≤ 10 words, naming example drills (no essays).
- refer_out_flags:
  - Only if pain or red flags.
  - 1–3 bullets, neutral language, reference the relevant test(s).

5) client_summary
- 3–5 sentences.
- 6th grade reading level.
- Structure:
  - 1 sentence: what they did well.
  - 2–3 sentences: key improvement areas in friendly terms.
  - 1 sentence: how the planned training approach will help them.
- No technical jargon, no fear language, no diagnosis.

Global constraints:
- Total output (all fields combined) should be compact and high-yield, not exhaustive.
- No long paragraphs. Everything except summary/client_summary must be bullet-style, short, and skimmable.
- Do NOT add fields, headings, markdown, or commentary outside the specified JSON.
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
