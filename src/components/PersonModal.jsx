import { useEffect } from "react";
import WishCard from "./WishCard.jsx";

function initials(name = "") {
  return (
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "🎄"
  );
}

export default function PersonModal({ group, me, myClaims, onEdit, onDelete, onToggleClaim, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isMe = group.userId === me;
  const n = group.wishes.length;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label={`${group.name}'s wishlist`}>
        <div className="modal-ribbon" />
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>

        <div className="person-modal-head">
          <span className="avatar avatar-lg">{initials(group.name)}</span>
          <div>
            <h2 className="modal-title person-modal-name">
              {group.name}{isMe && <span className="you-tag">you</span>}'s wishlist
            </h2>
            <p className="modal-sub person-modal-sub">{n} {n === 1 ? "wish" : "wishes"}</p>
          </div>
        </div>

        <div className="person-modal-grid">
          {group.wishes.map((item) => (
            <WishCard
              key={item.id}
              item={item}
              me={me}
              claimedByMe={myClaims?.has(item.id)}
              hideWho
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
              onToggleClaim={() => onToggleClaim(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
