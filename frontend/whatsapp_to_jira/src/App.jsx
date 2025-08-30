import { useEffect, useState } from "react";
import axios from "axios";

function MockPanel({ onDraft }) {
  const [messages, setMessages] = useState([
    "Please fix the checkout bug",
    "Also make sure it works on mobile"
  ]);
  const [attachments, setAttachments] = useState([]);

  const generateDraft = async () => {
    try {
      const r = await axios.post("http://localhost:4000/parse", { messages, attachments });
      onDraft(r.data);
    } catch {
      alert("Parse failed");
    }
  };

  return (
    <section>
      <h3>Mock Input</h3>
      <textarea rows={6} value={messages.join("\n")} onChange={e => setMessages(e.target.value.split("\n"))} />
      <button onClick={generateDraft}>Generate Draft</button>
    </section>
  );
}

function DraftsPanel({ source, onDraftApproved }) {
  const [list, setList] = useState([]);
  const load = async () => {
    const r = await axios.get("http://localhost:4000/drafts");
    setList(r.data.filter(d => d.from === source));
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    const r = await axios.post(`http://localhost:4000/drafts/${id}/approve`);
    onDraftApproved(r.data);
  };

  return (
    <section>
      <h3>{source === "whatsapp" ? "WhatsApp Drafts" : "Slack Drafts"}</h3>
      <button onClick={load}>Refresh</button>
      {list.map(row => (
        <div key={row.id} style={{ border: "1px solid #ddd", margin: 8, padding: 8 }}>
          <b>#{row.id}</b> {row.messages.join(" / ")}
          <div>{row.draft.title} — {row.draft.priority}</div>
          <button onClick={() => approve(row.id)}>Approve → Jira</button>
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState("mock");
  const [draft, setDraft] = useState(null);
  const [issue, setIssue] = useState(null);

  const createJira = async () => {
    const r = await axios.post("http://localhost:4000/create-jira", draft);
    setIssue(r.data);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Multi-Channel → Jira</h1>
      <div>
        <button onClick={() => setTab("mock")}>Mock</button>
        <button onClick={() => setTab("whatsapp")}>WhatsApp</button>
        <button onClick={() => setTab("slack")}>Slack</button>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {tab === "mock" && <MockPanel onDraft={setDraft} />}
        {tab === "whatsapp" && <DraftsPanel source="whatsapp" onDraftApproved={setIssue} />}
        {tab === "slack" && <DraftsPanel source="slack" onDraftApproved={setIssue} />}

        <section>
          <h3>Review Draft</h3>
          {!draft ? <p>No draft yet</p> : (
            <>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              <button onClick={createJira}>Create Jira</button>
            </>
          )}
          {issue && <div>Created Jira: {issue.key}</div>}
        </section>
      </div>
    </div>
  );
}
