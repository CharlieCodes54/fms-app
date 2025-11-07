// api/fms-interpretation.js
// Vercel Node.js serverless function using OpenAI official SDK (CommonJS)

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

Use ONLY the data provided.

Do NOT provide medical diagnoses or claim to treat disease.

Identify movement pattern issues, asymmetries, and training priorities.

Flag any pain or zero scores for potential clinical referral.

Stay strictly within fitness professional scope.

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
     // Use a real available model; adjust if your account differs.
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

   // Enforce structure defensively
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

4. Commit changes.

Key corrections:
- Uses `gpt-4.1-mini` instead of nonexistent `gpt-5`.
- Uses CommonJS `require` compatible with default Vercel Node runtime.
- Assumes `openai` dependency exists (from Step 1).

---

## Step 3: Confirm environment variable on Vercel

In Vercel project settings:

- `Settings → Environment Variables`
- Ensure entry:
- **Name:** `OPENAI_API_KEY`
- **Value:** your actual key
- Scope includes **Production**
- If you edited/added it, save.

---

## Step 4: Redeploy

In Vercel:

- Go to your project → **Deployments**.
- Trigger **Redeploy** for latest commit.

---

## Step 5: Test live

On your deployed URL:

1. Fill out sample FMS data.
2. Click **Generate AI Summary**.

If it still fails:
- In Vercel, open the latest deployment → **Functions / Logs** for `api/fms-interpretation`.
- Any `MODULE_NOT_FOUND` or `invalid_model` error there tells you exactly what’s wrong and which of the above steps was skipped.

This sequence aligns your backend with Vercel + OpenAI; it will stop the generic “AI summary failed” alert.
::contentReference[oaicite:0]{index=0}
