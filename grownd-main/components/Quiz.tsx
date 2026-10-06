"use client";
// The scientist quiz: six questions, four answers each (keys A-D or 1-4), a flask that fills with
// the colours picked, then the result. Nothing is stored.
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ic } from "@/components/Icon";
import { QUIZ, TYPES, TYPE_ORDER } from "@/lib/missions";
import { css } from "@/lib/css";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function QuizFlask({ answers }: { answers: number[] }) {
  const flask = "M78 14 H122 V74 L176 196 Q184 216 164 216 H36 Q16 216 24 196 L78 74 Z", bh = 26;
  return (
    <svg viewBox="0 0 200 226" role="img" aria-label={`Your mix so far: ${answers.length} of 6 answers`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      <defs><clipPath id="grQF"><path d={flask} /></clipPath></defs>
      <g clipPath="url(#grQF)">
        {answers.map((j, i) => <rect key={`b${i}-${j}`} x={0} y={216 - (i + 1) * bh} width={200} height={bh + 1} className="gr-anim" style={{ fill: TYPES[TYPE_ORDER[j]].color, transformOrigin: `100px ${216 - i * bh}px`, transformBox: "view-box", animation: "grPour 550ms cubic-bezier(.2,.8,.2,1) both" }} />)}
        {answers.length > 0 && [0, 1, 2].map(j => <circle key={j} className="gr-anim" cx={70 + j * 30} cy={208} r={[4, 3, 3.5][j]} style={{ fill: "var(--ink,#F2F5FF)", opacity: 0.6, animation: `grRise ${2.4 + j * 0.5}s ease-in ${j * 0.6}s infinite` }} />)}
      </g>
      {[1, 2, 3, 4, 5].map(i => { const y = 216 - i * bh; return <line key={i} x1={150 - (216 - y) * 0.2} x2={162 - (216 - y) * 0.26} y1={y} y2={y} style={{ stroke: "var(--ink,#F2F5FF)", strokeWidth: 1.5, opacity: 0.4 }} />; })}
      <path d={flask} style={{ fill: "rgba(var(--ink-rgb,242,245,255),0.05)", stroke: "var(--ink,#F2F5FF)", strokeWidth: 3, strokeLinejoin: "round" }} />
      <rect x={70} y={6} width={60} height={10} rx={5} style={{ fill: "var(--ink,#F2F5FF)" }} />
    </svg>
  );
}

export function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const qRef = useRef<HTMLDivElement>(null);
  const done = step >= 6, idx = Math.min(step, 5);

  const pick = useCallback((j: number) => {
    if (lock.current || step >= 6) return;
    const next = answers.slice(0, step + 1);
    next[step] = j;
    lock.current = true;
    setAnswers(next);
    timer.current = setTimeout(() => { lock.current = false; setStep(s => s + 1); }, 320);
  }, [answers, step]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Keys A-D or 1-4 answer the current question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (step >= 6 || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = (e.key || "").toLowerCase();
      let i = "abcd".indexOf(k);
      if (i < 0) i = "1234".indexOf(k);
      if (k.length === 1 && i >= 0) { e.preventDefault(); pick(i); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, step]);

  // Each new question slides in, answers one after another.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const el = qRef.current;
    if (!el || reduced()) return;
    el.animate([{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(.2,.7,.2,1)" });
    el.querySelectorAll("[role=group] > *").forEach((b, i) => b.animate([{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: 80 + i * 60, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" }));
  }, [step]);

  const counts = [0, 0, 0, 0];
  answers.forEach(a => { if (a != null) counts[a]++; });
  let w = 0;
  counts.forEach((c, i) => { if (c > counts[w]) w = i; });
  const WT = TYPES[TYPE_ORDER[w]];
  const pct = done ? 100 : Math.round((step / 6) * 100);
  const qz = {
    playing: !done, done, num: idx + 1, pctText: `${pct}% DONE`, bar: `${Math.max(pct, 3)}%`, question: QUIZ[idx].q,
    answers: TYPE_ORDER.map((t, j) => {
      const sel = answers[idx] === j && !done;
      return {
        letter: "ABCD"[j], text: QUIZ[idx].a[j], pressed: sel,
        border: sel ? "var(--brand-ink,#C6F534)" : "var(--hair,#2C3757)", bg: sel ? TYPES[t].color : "var(--raised,#1B2340)",
        fg: sel ? "var(--on-accent,#0A0E1A)" : "var(--ink,#F2F5FF)", cbg: sel ? "var(--deep,#0A0E1A)" : TYPES[t].color,
        cfg: sel ? "var(--ink,#F2F5FF)" : "var(--on-accent,#0A0E1A)",
        shadow: sel ? "0 0 32px rgba(198,245,52,0.35)" : "0 8px 24px rgba(var(--shadow-rgb,4,7,16),0.45)", onClick: () => pick(j)
      };
    }),
    dots: QUIZ.map((_, i) => ({ bg: i < step || done ? "var(--brand,#C6F534)" : i === step ? "var(--ink,#F2F5FF)" : "var(--hair,#2C3757)" })),
    flask: <QuizFlask answers={answers.slice(0, Math.min(step + 1, 6)).filter(v => v != null)} />,
    answered: String(Math.min(answers.filter(v => v != null).length, 6)),
    backOpacity: step > 0 ? 1 : 0.4, backDisabled: step === 0,
    back: () => { if (step > 0 && !lock.current) setStep(s => s - 1); },
    restart: () => { clearTimeout(timer.current); lock.current = false; setStep(0); setAnswers([]); },
    result: { name: WT.name, color: WT.color, initial: WT.initial, tag: WT.tag, sentence: `You are ${WT.an} ${WT.name}`, href: `/quiz/${WT.slug}` },
    tally: TYPE_ORDER.map((t, i) => ({ label: TYPES[t].name.toUpperCase(), n: String(counts[i]), color: TYPES[t].color, width: `${(counts[i] / 6) * 100}%` }))
  };
  return (
    <section style={{ width: "100%", maxWidth: "1120px", margin: "0 auto", padding: "clamp(32px,5vw,64px) clamp(20px,4vw,48px) clamp(40px,5vw,64px)", minHeight: "calc(100vh - 72px)", display: "flex", flexDirection: "column" }}><h1 className="gr-sr">Scientist quiz: what kind of scientist is your child?</h1><div style={{ display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", lineHeight: "16px", fontWeight: "500", letterSpacing: "0.08em" }}><span aria-live="polite">QUESTION {qz.num} OF 6</span><span style={{ color: "var(--muted,#9FACC9)" }}>{qz.pctText}</span></div><div role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={6} aria-valuenow={qz.num} style={{ height: "8px", borderRadius: "8px", background: "var(--hair,#2C3757)", overflow: "hidden" }}><div style={{ height: "100%", width: qz.bar, background: "var(--brand,#C6F534)", borderRadius: "8px", transition: "width 400ms cubic-bezier(.2,.7,.2,1)" }}></div></div><div aria-hidden="true" style={{ display: "flex", gap: "6px" }}>{(qz.dots).map((d, i1) => (<Fragment key={i1}><span style={{ flex: "1", height: "3px", borderRadius: "3px", background: d.bg, transition: "background 300ms ease" }}></span></Fragment>))}</div></div><div ref={qRef} style={{ display: "flex", flexDirection: "column" }}>{(qz.playing) && (<><div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "clamp(16px,3vw,40px)", margin: "clamp(28px,5vw,56px) 0 clamp(24px,4vw,40px)" }}><h2 style={{ margin: "0", flex: "1", minWidth: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(30px,4.2vw,52px)", lineHeight: "1.05", fontWeight: "700", letterSpacing: "-0.02em", maxWidth: "900px", textWrap: "balance" }}>{qz.question}</h2><div style={css({ flex: "none", width: "var(--lay-flask-w)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" })}><div style={{ width: "100%" }}>{qz.flask}</div><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", letterSpacing: "0.08em", fontWeight: "500", color: "var(--muted,#9FACC9)", whiteSpace: "nowrap" }}>YOUR MIX {qz.answered}/6</span></div></div><div role="group" aria-label="Answers" style={css({ display: "grid", gridTemplateColumns: "var(--lay-quiz-cols)", gap: "16px" })}>{(qz.answers).map((a, i2) => (<Fragment key={i2}><button className="qz0-1 qz0-2" type="button" aria-pressed={a.pressed} onClick={a.onClick} style={css({ display: "flex", alignItems: "center", gap: "20px", minHeight: "var(--lay-tile-h)", padding: "18px 22px", borderRadius: "14px", background: a.bg, border: `2px solid ${a.border}`, boxShadow: a.shadow, color: a.fg, textAlign: "left", cursor: "pointer", transition: "box-shadow 150ms ease,border-color 150ms ease,transform 150ms ease,background 150ms ease" })}><span style={{ flex: "none", width: "52px", height: "52px", borderRadius: "999px", background: a.cbg, color: a.cfg, transition: "background 150ms ease", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "18px", fontWeight: "700" }}>{a.letter}</span><span style={{ fontSize: "clamp(16px,1.4vw,19px)", lineHeight: "1.35", fontWeight: "600" }}>{a.text}</span></button></Fragment>))}</div><p style={css({ margin: "16px 0 0", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)", display: "var(--lay-float-display)" })}>TIP: PRESS A, B, C OR D</p></>)}{(qz.done) && (<><div style={css({ marginTop: "clamp(28px,5vw,56px)", display: "grid", gridTemplateColumns: "var(--lay-result-cols)", gap: "clamp(24px,4vw,48px)", alignItems: "center", padding: "clamp(24px,4vw,48px)", borderRadius: "24px", background: "rgba(var(--raised-rgb,27,35,64),0.52)", backdropFilter: "blur(18px) saturate(150%)", WebkitBackdropFilter: "blur(18px) saturate(150%)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.11)", borderTop: `6px solid ${qz.result.color}` })}><div style={css({ width: "var(--lay-result-block)", height: "var(--lay-result-block)", borderRadius: "24px", background: qz.result.color, color: "var(--on-accent,#0A0E1A)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px" })}><span style={css({ fontFamily: "'Space Grotesk',sans-serif", fontSize: "var(--lay-result-initial)", lineHeight: "0.9", fontWeight: "700" })}>{qz.result.initial}</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", fontWeight: "500", textTransform: "uppercase" }}>{qz.result.name}</span></div><div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", fontWeight: "500", color: "var(--brand-ink,#C6F534)" }}>ALL 6 ANSWERED / RESULT READY</span><h2 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(34px,4.4vw,56px)", lineHeight: "1.02", fontWeight: "700", letterSpacing: "-0.02em" }}>{qz.result.sentence}.</h2><p style={{ margin: "0", fontSize: "18px", lineHeight: "28px", color: "var(--muted,#9FACC9)" }}>{qz.result.tag}</p><div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px 0", borderTop: "1px solid var(--hair,#2C3757)", borderBottom: "1px solid var(--hair,#2C3757)" }}>{(qz.tally).map((t, i3) => (<Fragment key={i3}><div style={{ display: "grid", gridTemplateColumns: "110px 1fr 20px", gap: "12px", alignItems: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", fontWeight: "500" }}><span>{t.label}</span><span style={{ height: "8px", borderRadius: "8px", background: "var(--hair,#2C3757)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: t.width, background: t.color, borderRadius: "8px" }}></span></span><span style={{ textAlign: "right" }}>{t.n}</span></div></Fragment>))}</div><Link className="qz0-3" href={qz.result.href} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "56px", padding: "14px 26px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontSize: "16px", fontWeight: "700", textDecoration: "none", transition: "box-shadow 150ms ease,transform 150ms ease" }}>See your scientist type {ic.arrow}</Link></div></div></>)}</div><div style={{ marginTop: "auto", paddingTop: "40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap" }}><div style={{ display: "flex", gap: "12px" }}><button className="qz0-4" type="button" onClick={qz.back} aria-disabled={qz.backDisabled} style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "48px", padding: "10px 20px", borderRadius: "14px", border: "2px solid var(--hair-strong,#6B7CAB)", background: "transparent", color: "var(--ink,#F2F5FF)", fontSize: "16px", fontWeight: "700", cursor: "pointer", opacity: qz.backOpacity }}>{ic.arrowL} Back</button><button className="qz0-5" type="button" onClick={qz.restart} style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "48px", padding: "10px 16px", borderRadius: "14px", border: "0", background: "transparent", color: "var(--brand-ink,#C6F534)", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>{ic.refresh} Start again</button></div><p style={{ margin: "0", maxWidth: "320px", fontSize: "14px", lineHeight: "22px", color: "var(--muted,#9FACC9)" }}>No account, no email, nothing stored. It is a quiz, not a form.</p></div></section>
  );
}
