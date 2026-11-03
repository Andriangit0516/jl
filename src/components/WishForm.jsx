import { useEffect, useRef, useState } from "react";

const PRIORITIES = ["Top pick", "Would love", "Nice to have"];

const LS_NAME = "cw_name"; // remember the person's name between visits

export default function WishForm({ onAdd, onClose }) {
  const [form, setForm] = useState({
    person_name: localStorage.getItem(LS_NAME) || "",
    title: "",
    url: "",
    details: "",
    price: "",
    priority: "Would love",
  });
  const [saving, setSaving] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const person_name = form.person_name.trim();
    const title = form.title.trim();
    if (!person_name || !title) return;

    let url = form.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;

    setSaving(true);
    localStorage.setItem(LS_NAME, person_name);
    await onAdd({
      person_name,
      title,
      url: url || null,
      details: form.details.trim() || null,
      price: form.price.trim() || null,
      priority: form.priority,
    });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Add a wish">
        <div className="modal-ribbon" />
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="modal-title">🎁 Add your wish</h2>
        <p className="modal-sub">Tell everyone what you'd love — the more detail, the better the gift!</p>

        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Your name <i>*</i></span>
            <input ref={firstField} value={form.person_name} onChange={set("person_name")}
              placeholder="e.g. Andrian" maxLength={60} required />
          </label>

          <label className="field">
            <span>What do you wish for? <i>*</i></span>
            <input value={form.title} onChange={set("title")}
              placeholder="e.g. Cozy wireless headphones" maxLength={120} required />
          </label>

          <label className="field">
            <span>Link to it 🔗</span>
            <input value={form.url} onChange={set("url")} type="text" inputMode="url"
              placeholder="Paste a shop link (Lazada, Shopee, Amazon…)" />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Rough price 💸</span>
              <input value={form.price} onChange={set("price")}
                placeholder="e.g. ~₱1,500 or any" maxLength={40} />
            </label>
            <label className="field">
              <span>How much do you want it?</span>
              <select value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p === "Top pick" ? "⭐ Top pick" : p === "Would love" ? "💚 Would love" : "🙂 Nice to have"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Details (size, color, notes…)</span>
            <textarea value={form.details} onChange={set("details")} rows={3}
              placeholder="e.g. Size M, prefers green, over-ear if possible 🎧" maxLength={500} />
          </label>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Adding…" : "🎄 Add to the tree"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
