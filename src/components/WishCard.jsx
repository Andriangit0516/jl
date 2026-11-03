const PRIORITY_META = {
  "Top pick": { cls: "pri-top", label: "⭐ Top pick" },
  "Would love": { cls: "pri-love", label: "💚 Would love" },
  "Nice to have": { cls: "pri-nice", label: "🙂 Nice to have" },
};

function initials(name = "") {
  return (
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "🎄"
  );
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "open link";
  }
}

export default function WishCard({ item, me, myName, onEdit, onDelete, onToggleClaim, hideWho }) {
  const pri = PRIORITY_META[item.priority] || PRIORITY_META["Would love"];
  const isMine = item.user_id && me && item.user_id === me;
  const claimedByMe = item.claimed_by && item.claimed_by === myName;

  return (
    <article className={"card " + (item.claimed_by ? "card-claimed" : "")}>
      <div className="card-head">
        {!hideWho && (
          <>
            <span className="avatar">{initials(item.person_name)}</span>
            <div className="card-who">
              <strong>{item.person_name}{isMine && <span className="you-tag">you</span>}</strong>
              <span className="wants">wishes for…</span>
            </div>
          </>
        )}
        <span className={"pri " + pri.cls + (hideWho ? " pri-right" : "")}>{pri.label}</span>
      </div>

      {item.image_url && (
        <a
          className="card-photo"
          href={item.url || item.image_url}
          target="_blank"
          rel="noreferrer noopener"
          title="View full size"
        >
          <img src={item.image_url} alt={item.title} loading="lazy" />
        </a>
      )}

      <h3 className="card-title">{item.title}</h3>

      {item.details && <p className="card-details">{item.details}</p>}

      {item.url && (
        <div className="card-meta">
          <a className="link" href={item.url} target="_blank" rel="noreferrer noopener">
            🔗 {hostOf(item.url)} ↗
          </a>
        </div>
      )}

      <div className="card-foot">
        {item.claimed_by ? (
          <div className="claimed-tag">
            🎁 Being gifted by <b>{claimedByMe ? "you" : item.claimed_by}</b>
            {claimedByMe && (
              <button className="mini-link" onClick={onToggleClaim}>undo</button>
            )}
          </div>
        ) : isMine ? (
          <span className="own-note">🌟 This is your wish</span>
        ) : (
          <button className="btn btn-green btn-sm" onClick={onToggleClaim}>
            🎅 I'll gift this
          </button>
        )}

        {isMine && (
          <>
            <button className="icon-btn" title="Edit your wish" onClick={onEdit}>✏️</button>
            <button className="icon-btn" title="Remove your wish" onClick={onDelete}>🗑️</button>
          </>
        )}
      </div>
    </article>
  );
}
