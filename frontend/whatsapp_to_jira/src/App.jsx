// frontend/src/App.jsx

import { useEffect, useState } from "react";
import axios from "axios";

function MockPanel({ onDraft }) {
  const [messages, setMessages] = useState([
    "Hey, can you redesign the checkout page? Payments fail sometimes.",
    "Also make sure it works on mobile."
  ]);
  const [attachments, setAttachments] = useState(["checkout_error.png"]);
  const [loading, setLoading] = useState(false);

  const generateDraft = async () => {
    setLoading(true);
    try {
      const r = await axios.post("http://localhost:4000/parse", { messages, attachments });
      onDraft(r.data);
    } catch (e) {
      alert("Parse failed. Is backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ display:"grid", gap:8 }}>
      <h3>Mock WhatsApp Input</h3>
      <textarea
        rows={10}
        style={{ width:"100%", padding:8 }}
        value={messages.join("\n")}
        onChange={e => setMessages(e.target.value.split("\n"))}
      />
      <input
        style={{ width:"100%", padding:8 }}
        placeholder="attachments (comma-separated)"
        value={attachments.join(",")}
        onChange={e => setAttachments(e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
      />
      <button onClick={generateDraft} disabled={loading} style={{ padding:"8px 12px" }}>
        {loading ? "Generating..." : "Generate Draft"}
      </button>
    </section>
  );
}

function TwilioPanel({ onDraftApproved }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get("http://localhost:4000/drafts");
      setList(r.data);
    } catch {
      alert("Failed to load drafts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      const r = await axios.post(`http://localhost:4000/drafts/${id}/approve`);
      onDraftApproved(r.data);
    } catch {
      alert("Jira creation failed");
    }
  };

  return (
    <section style={{ display:"grid", gap:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h3>WhatsApp (Twilio) Drafts</h3>
        <button onClick={load} disabled={loading}>Refresh</button>
      </div>
      {list.length === 0 ? <p>No drafts yet. Send a WhatsApp message to your Sandbox.</p> : (
        <div style={{ display:"grid", gap:8 }}>
          {list.map(row => (
            <div key={row.id} style={{ border:"1px solid #ddd", borderRadius:8, padding:8 }}>
              <div style={{ fontWeight:600 }}>#{row.id} from {row.from}</div>
              <div style={{ fontSize:14, opacity:.8, margin:"6px 0" }}>
                {row.messages.join(" / ")}
              </div>
              <div style={{ fontSize:12, opacity:.8 }}>
                Attachments: {row.attachments?.length ? row.attachments.join(", ") : "None"}
              </div>
              <div style={{ marginTop:6, fontSize:14 }}>
                <b>Draft:</b> {row.draft.title} — {row.draft.priority} — [{(row.draft.tags || []).join(", ")}]
              </div>
              <div style={{ marginTop:8 }}>
                <button onClick={() => approve(row.id)}>Approve → Create in Jira</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState("mock");
  const [draft, setDraft] = useState(null);
  const [issue, setIssue] = useState(null);
  const [creating, setCreating] = useState(false);

  const createJira = async () => {
    if (!draft) return;
    setCreating(true);
    try {
      const r = await axios.post("http://localhost:4000/create-jira", draft);
      setIssue(r.data);
    } catch {
      alert("Jira creation failed. Check backend logs and .env.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding:24, fontFamily:"Inter, system-ui", maxWidth:1200, margin:"0 auto" }}>
      <h2>WhatsApp → AI Draft → Review → Jira</h2>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={() => setTab("mock")} disabled={tab==="mock"}>Mock Input</button>
        <button onClick={() => setTab("twilio")} disabled={tab==="twilio"}>WhatsApp (Twilio)</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {tab === "mock" ? (
          <MockPanel onDraft={setDraft} />
        ) : (
          <TwilioPanel onDraftApproved={(created) => setIssue(created)} />
        )}

        <section style={{ display:"grid", gap:8 }}>
          <h3>AI Draft → Review</h3>
          {!draft ? <p>No draft yet (use Mock tab) — or Approve a Twilio draft to create in Jira directly.</p> : (
            <div style={{ display:"grid", gap:8 }}>
              <label>Title
                <input style={{ width:"100%", padding:8 }} value={draft.title}
                  onChange={e => setDraft({ ...draft, title: e.target.value })}/>
              </label>
              <label>Description
                <textarea rows={10} style={{ width:"100%", padding:8 }} value={draft.description}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}/>
              </label>
              <label>Priority
                <select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })} style={{ padding:8 }}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </label>
              <label>Tags
                <input style={{ width:"100%", padding:8 }} value={draft.tags?.join(",") || ""}
                  onChange={e => setDraft({ ...draft, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })}/>
              </label>
              <button onClick={createJira} disabled={creating} style={{ padding:"8px 12px" }}>
                {creating ? "Creating..." : "Create in Jira"}
              </button>
            </div>
          )}

          {issue && (
            <div style={{ marginTop:8, padding:8, border:"1px solid #ddd", borderRadius:8 }}>
              <b>Created:</b> {issue.key} — check Jira.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

