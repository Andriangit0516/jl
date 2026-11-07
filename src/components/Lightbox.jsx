import { useEffect } from "react";
import { createPortal } from "react-dom";

// Fullscreen image preview. Rendered through a portal so it sits above any
// open modal (person wishlist, etc.). Escape is captured before other modals'
// listeners so only the lightbox closes, not the modal underneath it.
export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="Image preview">
      <button className="lightbox-x" onClick={onClose} aria-label="Close preview">✕</button>
      <img
        className="lightbox-img"
        src={src}
        alt={alt || ""}
        onClick={(e) => e.stopPropagation()}
      />
      {alt && <div className="lightbox-caption">{alt}</div>}
    </div>,
    document.body
  );
}
