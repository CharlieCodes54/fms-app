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
