function initials(name = "") {
  return (
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "🎄"
  );
}

export default function PersonCard({ group, isMe, onOpen }) {
  const { name, wishes, claimedCount } = group;
  const n = wishes.length;
  const thumbs = wishes.filter((w) => w.image_url).slice(0, 3);

  return (
    <button className="person-card" onClick={onOpen} title={`Open ${name}'s wishlist`}>
      <div className="person-top">
        <span className="avatar avatar-lg">{initials(name)}</span>
        <div className="person-id">
          <strong>{name}{isMe && <span className="you-tag">you</span>}</strong>
          <span className="person-count">🎁 {n} {n === 1 ? "wish" : "wishes"}</span>
        </div>
      </div>

      {thumbs.length > 0 ? (
        <div className="person-thumbs">
          {thumbs.map((w) => (
            <img key={w.id} src={w.image_url} alt="" loading="lazy" />
          ))}
          {n > thumbs.length && <span className="person-more">+{n - thumbs.length}</span>}
        </div>
      ) : (
        <div className="person-titles">
          {wishes.slice(0, 3).map((w) => (
            <span key={w.id} className="title-chip">{w.title}</span>
          ))}
          {n > 3 && <span className="title-chip title-more">+{n - 3} more</span>}
        </div>
      )}

      <div className="person-foot">
        <span className="open-hint">Open wishlist →</span>
        {/* Reserved count is hidden on your own card to keep the surprise. */}
        {!isMe && claimedCount > 0 && (
          <span className="gift-count">🎅 {claimedCount} being gifted</span>
        )}
      </div>
    </button>
  );
}
