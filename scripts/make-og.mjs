// One-off generator for the social share image (public/og-image.png, 1200x630).
// Run: npm i -D sharp && node scripts/make-og.mjs   (sharp can be removed after)
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "og-image.png");

const W = 1200;
const H = 630;

// Deterministic snow so re-runs produce the same image.
let seed = 7;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const snow = Array.from({ length: 46 }, () => {
  const r = 2 + rand() * 6;
  return { cx: rand() * W, cy: rand() * H, r, o: 0.15 + rand() * 0.5 };
})
  .map((s) => `<circle cx="${s.cx.toFixed(0)}" cy="${s.cy.toFixed(0)}" r="${s.r.toFixed(1)}" fill="#ffffff" opacity="${s.o.toFixed(2)}"/>`)
  .join("");

const FONT = "'Segoe UI','Helvetica Neue',Arial,sans-serif";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f432a"/>
      <stop offset="1" stop-color="#0a2b1b"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="70%">
      <stop offset="0" stop-color="#f2b600" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#f2b600" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${snow}

  <!-- candy-cane top + bottom accent -->
  <g>
    ${Array.from({ length: 30 }, (_, i) => {
      const x = i * 42;
      const fill = i % 2 === 0 ? "#e23b3b" : "#f6f1e6";
      return `<rect x="${x}" y="0" width="42" height="12" fill="${fill}"/><rect x="${x}" y="${H - 12}" width="42" height="12" fill="${i % 2 === 0 ? "#1b7a3d" : "#f6f1e6"}"/>`;
    }).join("")}
  </g>

  <!-- gift box (right) -->
  <g transform="translate(812,196)">
    <rect x="0" y="92" width="300" height="236" rx="18" fill="#e23b3b"/>
    <rect x="0" y="92" width="300" height="70" rx="18" fill="#c1121f"/>
    <rect x="-14" y="66" width="328" height="56" rx="16" fill="#cf2525"/>
    <rect x="128" y="66" width="44" height="262" fill="#f2b600"/>
    <rect x="-14" y="148" width="328" height="34" fill="#f2b600"/>
    <circle cx="128" cy="52" r="34" fill="none" stroke="#f2b600" stroke-width="22"/>
    <circle cx="172" cy="52" r="34" fill="none" stroke="#f2b600" stroke-width="22"/>
  </g>

  <!-- text (left) -->
  <text x="90" y="212" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="6" fill="#f2b600">BRIGADA CHRISTMAS PARTY</text>
  <text x="86" y="320" font-family="${FONT}" font-size="104" font-weight="800" fill="#ffffff">Wishlist</text>
  <text x="90" y="398" font-family="${FONT}" font-size="40" font-weight="700" fill="#ffe8a3">Share what you'd love 🎄</text>
  <text x="90" y="452" font-family="${FONT}" font-size="27" font-weight="500" fill="#dcefe1">Post links, photos &amp; details — browse everyone's list,</text>
  <text x="90" y="490" font-family="${FONT}" font-size="27" font-weight="500" fill="#dcefe1">and secretly gift a wish as Santa.</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(OUT, png);
console.log("Wrote " + OUT + " (1200x630)");
