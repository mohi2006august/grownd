// A one-off burst of particles (a finished reaction, a quiz result). Hidden with reduced motion.
import type { CSSProperties } from "react";

export function Burst({ color }: { color: string }) {
  const cols = [color, "var(--brand,#C6F534)", "var(--ink,#F2F5FF)"];
  return (
    <div className="gr-burst" aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, pointerEvents: "none" }}>
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2, d = 120 + (i % 3) * 50;
        const style = { position: "absolute", left: -6, top: -6, width: i % 2 ? 14 : 9, height: i % 2 ? 14 : 9, borderRadius: 999, background: cols[i % 3], "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px`, animation: `grBurst 1000ms cubic-bezier(.2,.7,.2,1) ${250 + i * 14}ms both` } as CSSProperties;
        return <span key={i} className="gr-anim" style={style} />;
      })}
    </div>
  );
}
