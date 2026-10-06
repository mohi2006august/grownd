"use client";
// A mission card: links to the mission, tilts towards the mouse.
import Link from "next/link";
import type { MouseEvent } from "react";
import { Icon } from "@/components/Icon";
import type { MissionView } from "@/lib/view";

export type CardMission = Pick<MissionView, "href" | "color" | "code" | "typeName" | "glyph" | "cat" | "title" | "line" | "agesText" | "lenText" | "price">;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MissionCard({ m }: { m: CardMission }) {
  const pad = "var(--lay-card-pad)";
  const arrow = <Icon name="arrow" size={18} stroke={2.25} />;
  const tilt = (e: MouseEvent<HTMLAnchorElement>) => {
    if (reduced()) return;
    const el = e.currentTarget, b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 9).toFixed(2)}deg) translateY(-4px)`;
    el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
  };
  const untilt = (e: MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.transform = ""; e.currentTarget.style.setProperty("--gy", "-20%"); };
  return (
    <Link className="hmc-1" href={m.href} data-cursor="VIEW" onMouseMove={tilt} onMouseLeave={untilt} style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", background: "rgba(var(--raised-rgb,27,35,64),0.52)", backdropFilter: "blur(18px) saturate(150%)", WebkitBackdropFilter: "blur(18px) saturate(150%)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.11)", borderRadius: "24px", boxShadow: "0 8px 24px rgba(var(--shadow-rgb,4,7,16),0.45),inset 0 1px 0 rgba(var(--ink-rgb,242,245,255),0.07)", overflow: "hidden", textDecoration: "none", color: "var(--ink,#F2F5FF)", transition: "box-shadow 150ms ease,transform 250ms cubic-bezier(.2,.7,.2,1)", willChange: "transform" }}><span aria-hidden="true" style={{ position: "absolute", inset: "0", zIndex: "2", pointerEvents: "none", background: "radial-gradient(circle at var(--gx,50%) var(--gy,-20%),rgba(var(--ink-rgb,242,245,255),0.13),transparent 45%)" }}></span><div style={{ position: "relative", height: "200px", flex: "none", background: m.color, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "var(--on-accent,#0A0E1A)", overflow: "hidden" }}><span className="gr-anim" aria-hidden="true" style={{ position: "absolute", inset: "-20px", backgroundImage: "radial-gradient(rgba(var(--deep-rgb,10,14,26),0.16) 2px,transparent 2.6px)", backgroundSize: "18px 18px", animation: "grDots 18s linear infinite" }}></span><div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: "8px", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", lineHeight: "16px", fontWeight: "500", letterSpacing: "0.08em", textTransform: "uppercase" }}><span>{m.code}</span><span>{m.typeName}</span></div><span style={{ position: "relative", fontFamily: "'Space Grotesk',sans-serif", fontSize: "60px", lineHeight: "0.9", fontWeight: "700", letterSpacing: "-0.03em" }}>{m.glyph}</span></div><div style={{ padding: pad, display: "flex", flexDirection: "column", gap: "12px", flex: "1" }}><div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}><span style={{ display: "inline-flex", alignItems: "center", minHeight: "28px", padding: "4px 12px", borderRadius: "999px", background: m.color, color: "var(--on-accent,#0A0E1A)", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", lineHeight: "16px", fontWeight: "500", letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.typeName}</span><span style={{ display: "inline-flex", alignItems: "center", minHeight: "28px", padding: "4px 12px", borderRadius: "999px", border: "1px solid var(--hair-strong,#6B7CAB)", color: "var(--ink,#F2F5FF)", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", lineHeight: "16px", fontWeight: "500", letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.cat}</span></div><h3 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "24px", lineHeight: "30px", fontWeight: "600", color: "var(--ink,#F2F5FF)" }}>{m.title}</h3><p style={{ margin: "0", fontFamily: "'Figtree',sans-serif", fontSize: "14px", lineHeight: "22px", color: "var(--muted,#9FACC9)", textWrap: "pretty" }}>{m.line}</p><div style={{ display: "flex", gap: "12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "15px", lineHeight: "20px", fontWeight: "500", color: "var(--ink,#F2F5FF)" }}><span>{m.agesText}</span><span style={{ color: "var(--hair-strong,#6B7CAB)" }}>/</span><span>{m.lenText}</span></div><div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid rgba(var(--ink-rgb,242,245,255),0.10)", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "44px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "15px", lineHeight: "20px", fontWeight: "500", color: "var(--ink,#F2F5FF)" }}>{m.price}</span><span style={{ display: "inline-flex", gap: "6px", alignItems: "center", color: "var(--brand-ink,#C6F534)", fontFamily: "'Figtree',sans-serif", fontSize: "15px", fontWeight: "700" }}>View mission {arrow}</span></div></div></Link>
  );
}
