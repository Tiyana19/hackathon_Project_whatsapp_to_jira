const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { twiml: { MessagingResponse } } = require("twilio");
require("dotenv").config();

const app = express();
app.use(cors());

// Twilio sends form-encoded webhooks:
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10mb" }));

// --- In-memory store for drafts created from WhatsApp --
// DO NOT use in production; replace with a DB.
const drafts = new Map(); // id -> { id, from, messages[], attachments[], draft }
let nextId = 1;

// ---------- Helpers ----------
function naiveParse(messages, attachments = []) {
  const text = messages.join(" ");
  const title = (text.match(/.{1,100}/)?.[0] || "Untitled task from WhatsApp").trim();
  const priority =
    /(down|fail|failing|error|urgent|critical|prod|payment|crash|blocker)/i.test(text) ? "High" :
    /(slow|confuse|bug|fix|issue|problem)/i.test(text) ? "Medium" : "Low";
  const tags = [];
  if (/mobile|android|ios|responsive/i.test(text)) tags.push("mobile");
  if (/checkout/i.test(text)) tags.push("checkout");
  if (/payment|upi|card|gateway/i.test(text)) tags.push("payments");
  if (/ui|ux|design/i.test(text)) tags.push("design");
  const description =
`Source: WhatsApp

Conversation:
${messages.map(m => `- ${m}`).join("\n")}

Attachments: ${attachments.join(", ") || "None"}`;
  return { title, description, priority, tags, attachments };
}

async function callOllama(messages, attachments = []) {
  const prompt = `
You convert informal WhatsApp chat into a JIRA task in STRICT JSON.

Fields:
- title (<=100 chars, action-oriented)
- description (4-8 lines, include key details; mention attachments if any)
- priority: High | Medium | Low  (High if failures/outages/payments/security)
- tags: 2-5 short keywords (e.g., checkout, payments, mobile, UI)
- attachments: array of strings (filenames or URLs)

Chat messages:
${messages.map(m => `- ${m}`).join("\n")}

Attachments:
${attachments.join(", ") || "None"}

Return ONLY JSON. No extra text.
`.trim();

  const url = `${process.env.OLLAMA_URL || "http://localhost:11434"}/api/generate`;
  const model = process.env.OLLAMA_MODEL || "llama3.1";

  const resp = await axios.post(url, {
    model,
    prompt,
    stream: false,
    options: { temperature: 0.2, top_p: 0.9 }
  }, { timeout: 60000 });

  const raw = resp?.data?.response || "";
  const jsonMatch = raw.match(/\{[\s\S]*\}$/);
  if (!jsonMatch) throw new Error("Model did not return JSON.");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    title: parsed.title || "Task from WhatsApp",
    description: parsed.description || messages.join("\n"),
    priority: /^(High|Medium|Low)$/i.test(parsed.priority) ? parsed.priority : "Medium",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    attachments: Array.isArray(parsed.attachments) ? parsed.attachments : attachments
  };
}

// Jira Cloud prefers Atlassian Document Format (ADF). Make plain text ADF.
function toADF(text) {
  const lines = String(text).split("\n");
  const content = [];
  lines.forEach((line, i) => {
    if (line) content.push({ type: "text", text: line });
    if (i < lines.length - 1) content.push({ type: "hardBreak" });
  });
  return { type: "doc", version: 1, content: [{ type: "paragraph", content }] };
}

async function createJiraIssue(payload) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue`;
  const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
  return axios.post(url, payload, {
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }
  });
}

// ---------- Core REST routes (used by the React app) ----------

// Parse (mock messages) using Ollama or fallback
app.post("/parse", async (req, res) => {
  const { messages = [], attachments = [] } = req.body || {};
  try {
    const draft = await callOllama(messages, attachments);
    res.json(draft);
  } catch (e) {
    console.warn("Ollama parse failed, using naiveParse:", e.message || e);
    res.json(naiveParse(messages, attachments));
  }
});

// Create Jira from a draft payload (used by UI approve button)
app.post("/create-jira", async (req, res) => {
  const { title, description, priority = "Medium", tags = [] } = req.body || {};
  const baseFields = {
    project: { key: process.env.JIRA_PROJECT_KEY },
    summary: title,
    description: toADF(description),
    issuetype: { name: "Task" },
    labels: tags
  };

  try {
    let r;
    try {
      r = await createJiraIssue({ fields: { ...baseFields, priority: { name: priority } } });
    } catch (e) {
      // retry without priority if instance doesn't support given name
      r = await createJiraIssue({ fields: baseFields });
    }
    res.json({ key: r.data.key, self: r.data.self });
  } catch (e) {
    res.status(500).json({ error: "Jira creation failed", details: e?.response?.data || String(e) });
  }
});

// ---------- Twilio WhatsApp webhook ----------
// Configure this URL in Twilio Sandbox "When a message comes in"
app.post("/twilio/whatsapp", async (req, res) => {
  const body = req.body || {};
  const from = body.From || body.WaId || "unknown";
  const text = body.Body || "";
  const numMedia = parseInt(body.NumMedia || "0", 10) || 0;
  const attachments = [];
  for (let i = 0; i < numMedia; i++) {
    const url = body[`MediaUrl${i}`];
    if (url) attachments.push(url);
  }

  const messages = [text].filter(Boolean);

  // Build a draft using Ollama (fallback to heuristic)
  const draft = await (async () => {
    try { return await callOllama(messages, attachments); }
    catch { return naiveParse(messages, attachments); }
  })();

  const id = String(nextId++);
  drafts.set(id, { id, from, messages, attachments, draft });

  // Minimal TwiML reply so user sees confirmation in WhatsApp
  const twiml = new MessagingResponse();
  twiml.message(
    `Draft created (#${id})\nTitle: ${draft.title}\nPriority: ${draft.priority}\nTags: ${draft.tags.join(", ")}`
  );
  res.type("text/xml").send(twiml.toString());
});

// List stored drafts (for the UI)
app.get("/drafts", (req, res) => {
  res.json(Array.from(drafts.values()));
});

// Approve a stored draft -> create Jira
app.post("/drafts/:id/approve", async (req, res) => {
  const row = drafts.get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  try {
    const payload = row.draft;
    const baseFields = {
      project: { key: process.env.JIRA_PROJECT_KEY },
      summary: payload.title,
      description: toADF(payload.description),
      issuetype: { name: "Task" },
      labels: payload.tags || []
    };
    let r;
    try {
      r = await createJiraIssue({ fields: { ...baseFields, priority: { name: payload.priority || "Medium" } } });
    } catch {
      r = await createJiraIssue({ fields: baseFields });
    }
    res.json({ key: r.data.key, self: r.data.self });
  } catch (e) {
    res.status(500).json({ error: "Jira creation failed", details: e?.response?.data || String(e) });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Backend running → http://localhost:${process.env.PORT}`);
});
