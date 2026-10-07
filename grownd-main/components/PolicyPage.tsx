// A policy page (terms, privacy, refunds): a readable column of headed sections.
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { fill, UPDATED, type Policy, type PolicyValues } from "@/lib/policies";

const mono = { fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: "500", letterSpacing: "0.08em" };
const body = { margin: "0", fontSize: "17px", lineHeight: "28px", color: "var(--ink,#F2F5FF)" };

/** Text with [words](/path) links. */
function rich(text: string): ReactNode {
  return text.split(/(\[[^\]]+\]\(\/[^)]*\))/).map((part, i) => {
    const m = /^\[([^\]]+)\]\((\/[^)]*)\)$/.exec(part);
    return m
      ? <Link key={i} href={m[2]} style={{ color: "var(--brand-ink,#C6F534)", textDecoration: "underline", textUnderlineOffset: "3px" }}>{m[1]}</Link>
      : <Fragment key={i}>{part}</Fragment>;
  });
}

export function PolicyPage({ policy, values }: { policy: Policy; values: PolicyValues }) {
  const t = (s: string) => rich(fill(s, values));
  return (
    <article style={{ width: "100%", maxWidth: "860px", margin: "0 auto", padding: "clamp(48px,7vw,96px) clamp(20px,4vw,48px)", display: "flex", flexDirection: "column", gap: "40px" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <span style={{ ...mono, color: "var(--brand-ink,#C6F534)" }}>{policy.eyebrow}</span>
        <h1 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(40px,5.4vw,64px)", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.025em" }}>{policy.title}</h1>
        <p style={{ ...body, fontSize: "19px", lineHeight: "30px", color: "var(--muted,#9FACC9)" }}>{t(policy.intro)}</p>
        <p style={{ ...mono, margin: "0", fontSize: "12px", color: "var(--muted,#9FACC9)" }}>LAST UPDATED {UPDATED.toUpperCase()}</p>
      </header>
      {policy.sections.map(s => (
        <section key={s.heading} style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "28px", borderTop: "1px solid var(--hair,#2C3757)" }}>
          <h2 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "26px", lineHeight: "32px", fontWeight: "700", letterSpacing: "-0.01em" }}>{s.heading}</h2>
          {s.paragraphs?.map(p => <p key={p} style={body}>{t(p)}</p>)}
          {s.list && (
            <ul style={{ ...body, paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {s.list.map(li => <li key={li}>{t(li)}</li>)}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
