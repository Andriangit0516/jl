import { useEffect, useRef, useState } from "react";
import { fileToCompressedDataURL, imageFromEvent } from "../lib/image.js";

const PRIORITIES = ["Top pick", "Would love", "Nice to have"];

export default function WishForm({ onSubmit, onClose, authorName, editing }) {
  const isEdit = Boolean(editing);
  const [form, setForm] = useState({
    title: editing?.title || "",
    url: editing?.url || "",
    details: editing?.details || "",
    priority: editing?.priority || "Would love",
  });
  const [image, setImage] = useState(editing?.image_url || null); // compressed data URL
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const firstField = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Paste a screenshot anywhere in the modal (Ctrl/Cmd+V).
  useEffect(() => {
    async function onPaste(e) {
      const file = imageFromEvent(e);
      if (file) {
        e.preventDefault();
        await loadImage(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function loadImage(file) {
    setImgErr("");
    setImgBusy(true);
    try {
      const dataUrl = await fileToCompressedDataURL(file);
      if (dataUrl.length > 2_000_000) {
        setImgErr("That image is a bit large even after shrinking — try a smaller crop.");
      } else {
        setImage(dataUrl);
      }
    } catch (err) {
      setImgErr(err.message || "Couldn't process that image.");
    } finally {
      setImgBusy(false);
    }
  }

  function onPick(e) {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
    e.target.value = ""; // allow re-picking the same file
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = imageFromEvent(e);
    if (file) loadImage(file);
  }

  async function submit(e) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    let url = form.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;

    setSaving(true);
    await onSubmit({
      title,
      url: url || null,
      details: form.details.trim() || null,
      priority: form.priority,
      image_url: image || null,
    });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit wish" : "Add a wish"}>
        <div className="modal-ribbon" />
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="modal-title">{isEdit ? "✏️ Edit your wish" : "🎁 Add your wish"}</h2>
        <p className="modal-sub">
          {isEdit ? "Update the details below." : <>Posting as <b>{authorName}</b> — add a photo so there's no mixup!</>}
        </p>

        <form onSubmit={submit} className="form">
          <label className="field">
            <span>What do you wish for? <i>*</i></span>
            <input ref={firstField} value={form.title} onChange={set("title")}
              placeholder="e.g. Cozy wireless headphones" maxLength={120} required />
          </label>

          {/* Photo / screenshot: click, drag-drop, or paste (Ctrl+V). */}
          <div className="field">
            <span>Photo or screenshot 📸</span>
            {image ? (
              <div className="img-preview">
                <img src={image} alt="wish preview" />
                <button type="button" className="img-remove" onClick={() => setImage(null)} title="Remove photo">✕</button>
              </div>
            ) : (
              <div
                className={"dropzone" + (dragOver ? " dropzone-over" : "")}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
              >
                {imgBusy ? (
                  <span>✨ Processing image…</span>
                ) : (
                  <>
                    <span className="dz-emoji">🖼️</span>
                    <span><b>Click to upload</b>, drag an image here,<br />or <b>paste a screenshot</b> (Ctrl / ⌘ + V)</span>
                  </>
                )}
              </div>
            )}
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPick} />
            {imgErr && <small className="img-err">⚠️ {imgErr}</small>}
          </div>

          <label className="field">
            <span>Link to it 🔗</span>
            <input value={form.url} onChange={set("url")} type="text" inputMode="url"
              placeholder="Paste a shop link (Lazada, Shopee, Amazon…)" />
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

          <label className="field">
            <span>Details (size, color, notes…)</span>
            <textarea value={form.details} onChange={set("details")} rows={3}
              placeholder="e.g. Size M, prefers green, over-ear if possible 🎧" maxLength={500} />
          </label>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || imgBusy}>
              {saving ? "Saving…" : isEdit ? "💾 Save changes" : "🎄 Add to the tree"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
