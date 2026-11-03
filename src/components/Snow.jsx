import { useMemo } from "react";

// Lightweight CSS snow — a fixed layer of drifting flakes behind the content.
export default function Snow({ count = 40 }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic-ish spread so flakes don't clump (no randomness needed).
        const left = (i * 97) % 100;
        const size = 6 + ((i * 13) % 14);
        const duration = 8 + ((i * 7) % 12);
        const delay = -((i * 11) % 15);
        const opacity = 0.35 + ((i * 17) % 50) / 100;
        return { left, size, duration, delay, opacity, char: i % 3 === 0 ? "❄" : "•" };
      }),
    [count]
  );

  return (
    <div className="snow" aria-hidden="true">
      {flakes.map((f, i) => (
        <span
          key={i}
          className="flake"
          style={{
            left: f.left + "%",
            fontSize: f.size + "px",
            opacity: f.opacity,
            animationDuration: f.duration + "s",
            animationDelay: f.delay + "s",
          }}
        >
          {f.char}
        </span>
      ))}
    </div>
  );
}
