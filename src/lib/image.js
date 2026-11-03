// Turn a File/Blob (an uploaded image OR a pasted screenshot) into a compressed
// data-URL string. We downscale + re-encode so screenshots stay small enough to
// store directly in the database row — no storage bucket setup required.
export function fileToCompressedDataURL(file, { maxDim = 1100, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("That doesn't look like an image."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't load the image."));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        // White backdrop so transparent PNGs/screenshots don't go black as JPEG.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Pull the first image out of a paste/drop event, if any.
export function imageFromEvent(e) {
  const items = e.clipboardData?.items || e.dataTransfer?.items;
  if (items) {
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) return it.getAsFile();
    }
  }
  const files = e.dataTransfer?.files;
  if (files) {
    for (const f of files) if (f.type.startsWith("image/")) return f;
  }
  return null;
}
