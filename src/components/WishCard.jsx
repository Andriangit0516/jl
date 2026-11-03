import { useState } from "react";

const PRIORITY_META = {
  "Top pick": { cls: "pri-top", label: "⭐ Top pick" },
  "Would love": { cls: "pri-love", label: "💚 Would love" },
  "Nice to have": { cls: "pri-nice", label: "🙂 Nice to have" },
};

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "🎄";
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "open link";
  }
}

export default function WishCard({ item, onDelete, onToggleClaim }) {
  const [claiming, setClaiming] = useState(false);
  const [name, setName] = useState(localStorage.getItem("cw_name") || "");
  const pri = PRIORITY_META[item.priority] || PRIORITY_META["Would love"];

  function confirmClaim() {
    const n = name.trim();
    if (!n) return;
    localStorage.setItem("cw_name", n);
    onToggleClaim(n);
    setClaiming(false);
  }

  return (
    <article className={"card " + (item.claimed_by ? "card-claimed" : "")}>
      <div className="card-head">
        <span className="avatar">{initials(item.person_name)}</span>
        <div className="card-who">
          <strong>{item.person_name}</strong>
          <span className="wants">wishes for…</span>
        </div>
        <span className={"pri " + pri.cls}>{pri.label}</span>
      </div>

      <h3 className="card-title">{item.title}</h3>

      {item.details && <p className="card-details">{item.details}</p>}

      <div className="card-meta">
        {item.price && <span className="price">💸 {item.price}</span>}
        {item.url && (
          <a className="link" href={item.url} target="_blank" rel="noreferrer noopener">
            🔗 {hostOf(item.url)} ↗
          </a>
        )}
      </div>

      <div className="card-foot">
        {item.claimed_by ? (
          <div className="claimed-tag">
            🎁 Being gifted by <b>{item.claimed_by}</b>
            <button className="mini-link" onClick={() => onToggleClaim(null)}>undo</button>
          </div>
        ) : claiming ? (
          <div className="claim-row">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmClaim()}
              placeholder="Your name"
              maxLength={60}
            />
            <button className="btn btn-primary btn-sm" onClick={confirmClaim}>Claim 🎁</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setClaiming(false)}>✕</button>
          </div>
        ) : (
          <button className="btn btn-green btn-sm" onClick={() => setClaiming(true)}>
            🎅 I'll gift this
          </button>
        )}

        <button className="icon-btn" title="Remove wish" onClick={onDelete}>🗑️</button>
      </div>
    </article>
  );
}
