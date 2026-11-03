import { useEffect, useRef, useState } from "react";

export default function ProfileModal({ currentName, onSave, onClose }) {
  const [name, setName] = useState(currentName || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    firstField.current?.select();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setErr("Please enter a name.");
    setErr("");
    setSaving(true);
    const { error } = await onSave(trimmed);
    setSaving(false);
    if (error) setErr(error);
    else onClose();
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm" role="dialog" aria-modal="true" aria-label="Edit your name">
        <div className="modal-ribbon" />
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="modal-title">👤 Edit your name</h2>
        <p className="modal-sub">This is the name shown on all your wishes.</p>

        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Display name <i>*</i></span>
            <input ref={firstField} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Andrian Dayag" maxLength={60} autoComplete="name" required />
          </label>

          {err && <div className="auth-err">⚠️ {err}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "💾 Save name"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
