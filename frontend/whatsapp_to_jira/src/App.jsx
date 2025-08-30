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
      <textarea style={{ width: "400px", height: "150px", padding: "10px", border: "2px solid #3793c9ff", color: "#ffffffff", fontSize: "16px", resize: "vertical", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)" }} rows={6} value={messages.join("\n")} onChange={e => setMessages(e.target.value.split("\n"))} />
      <button style={{display: "block", margin: "10px auto", padding: "10px 20px", backgroundColor: "#3793c9ff", color: "#ffffff", border: "none", borderRadius: "8px", cursor: "pointer"}} onClick={generateDraft}>Generate Draft</button>
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
          <button  onClick={() => approve(row.id)}>Approve → Jira</button>
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
    <div style={{ padding: 20, display:"grid", gridTemplateColumns: "1fr 1fr 3fr", gap: 10, alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ gridColumn: "1 / span 3" }} >CHAT TO JIRA</h1>
      <div style={{ gridColumn: "1 / span 3", gap: 20, margin: "auto"}}>
        <button style={{marginLeft: "10px", paddingRight: "10px"}} onClick={() => setTab("mock")}>Mock</button>
        <button style={{marginLeft: "10px", paddingRight: "10px"}} onClick={() => setTab("whatsapp")}>WhatsApp</button>
        <button style={{marginLeft: "10px", paddingRight: "10px"}} onClick={() => setTab("slack")}>Slack</button>
      </div>

      <div style={{ padding: 20, border: "1px solid #ddd", display: "flex", gap: 20, gridColumn: "1 / span 3" }}>
        {tab === "mock" && <MockPanel onDraft={setDraft} />}
        {tab === "whatsapp" && <DraftsPanel source="whatsapp" onDraftApproved={setIssue} />}
        {tab === "slack" && <DraftsPanel source="slack" onDraftApproved={setIssue} />}

        <section style={{display:"flex", flexDirection:"column"}}>
          <h3>Review Draft</h3>
          {!draft ? <p>No draft yet</p> : (
            <>
              <input style={{display:"inline", width: "400px", height: "20px", padding: "10px", border: "2px solid #3793c9ff", borderRadius: "8px", color: "#ffffffff", fontSize: "16px", resize: "vertical", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)" }} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <textarea style={{display:"inline", width: "400px", height: "150px", padding: "10px", border: "2px solid #3793c9ff", borderRadius: "8px", color: "#ffffffff", fontSize: "16px", resize: "vertical", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)" }} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              <button style={{display: "block", margin: "10px auto", padding: "10px 20px", backgroundColor: "#3793c9ff", color: "#ffffff", border: "none", borderRadius: "8px", cursor: "pointer"}} onClick={createJira}>Create Jira</button>
            </>
          )}
          {issue && <div>Created Jira: {issue.key}</div>}
        </section>
      </div>
    </div>
  );
}
