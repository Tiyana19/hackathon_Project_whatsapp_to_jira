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

const drafts = new Map(); // id -> { id, from, messages[], attachments[], draft }
let nextId = 1;

// ---------------- Draft Parser ----------------
function naiveParse(messages, attachments = []) {
  const text = messages.join(" ");
  const title = (text.match(/.{1,100}/)?.[0] || "Untitled task").trim();
  const priority =
    /(down|fail|failing|error|urgent|critical|prod|payment|crash|blocker)/i.test(text) ? "High" :
    /(slow|confuse|bug|fix|issue|problem)/i.test(text) ? "Medium" : "Low";
  const tags = [];
  if (/mobile|android|ios|responsive/i.test(text)) tags.push("mobile");
  if (/checkout/i.test(text)) tags.push("checkout");
  if (/payment|upi|card|gateway/i.test(text)) tags.push("payments");
  if (/ui|ux|design/i.test(text)) tags.push("design");

  const description =
`Source: ${attachments.length ? "Message + Attachments" : "Message"}

Conversation:
${messages.map(m => `- ${m}`).join("\n")}

Attachments: ${attachments.join(", ") || "None"}`;

  return { title, description, priority, tags, attachments };
}

// ---------------- Jira Helpers ----------------
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

// ---------------- REST API ----------------
// Parse mock messages
app.post("/parse", (req, res) => {
  const { messages = [], attachments = [] } = req.body || {};
  res.json(naiveParse(messages, attachments));
});

// Create Jira from a draft
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
    } catch {
      r = await createJiraIssue({ fields: baseFields });
    }
    console.log(` Created Jira issue: ${process.env.JIRA_BASE_URL}/browse/${r.data.key}`);
    res.json({ key: r.data.key, self: r.data.self });
  } catch (e) {
    console.error(" Jira creation failed:", e?.response?.data || e.message || e);
    res.status(500).json({ error: "Jira creation failed", details: e?.response?.data || String(e) });
  }
});

// List drafts
app.get("/drafts", (req, res) => {
  res.json(Array.from(drafts.values()));
});

// Approve draft
app.post("/drafts/:id/approve", async (req, res) => {
  const row = drafts.get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });

  const baseFields = {
    project: { key: process.env.JIRA_PROJECT_KEY },
    summary: row.draft.title,
    description: toADF(row.draft.description),
    issuetype: { name: "Task" },
    labels: row.draft.tags || []
  };

  try {
    let r;
    try {
      r = await createJiraIssue({ fields: { ...baseFields, priority: { name: row.draft.priority || "Medium" } } });
    } catch {
      r = await createJiraIssue({ fields: baseFields });
    }
    res.json({ key: r.data.key, self: r.data.self });
  } catch (e) {
    console.error("Jira creation failed:", e?.response?.data || e.message || e);
    res.status(500).json({ error: "Jira creation failed", details: e?.response?.data || String(e) });
  }
});

// ---------------- Twilio WhatsApp ----------------
app.post("/twilio/whatsapp", (req, res) => {
  const body = req.body || {};
  const from = body.From || "unknown";
  const text = body.Body || "";
  const numMedia = parseInt(body.NumMedia || "0", 10) || 0;
  const attachments = [];
  for (let i = 0; i < numMedia; i++) {
    const url = body[`MediaUrl${i}`];
    if (url) attachments.push(url);
  }

  const messages = [text].filter(Boolean);
  const draft = naiveParse(messages, attachments);

  const id = String(nextId++);
  drafts.set(id, { id, from: "whatsapp", messages, attachments, draft });

  const twiml = new MessagingResponse();
  twiml.message(`Draft created (#${id})\nTitle: ${draft.title}\nPriority: ${draft.priority}`);
  res.type("text/xml").send(twiml.toString());
});

// ---------------- Slack ----------------
app.post("/slack/events", express.json(), (req, res) => {
  const body = req.body;

  // Slack URL verification
  if (body.type === "url_verification") {
    console.log(" Slack verification received");
    return res.send(body.challenge);
  }

  // Slack message event
  if (body.event && body.event.type === "message" && !body.event.bot_id) {
    const userMsg = body.event.text;
    const messages = [userMsg];
    const draft = naiveParse(messages);

    const id = String(nextId++);
    drafts.set(id, { id, from: "slack", messages, attachments: [], draft });
    console.log(` Slack message captured: ${userMsg}`);
  }

  res.send("ok");
});

// ---------------- Start Server ----------------
app.listen(process.env.PORT, () => {
  console.log(`Backend running → http://localhost:${process.env.PORT}`);
});
