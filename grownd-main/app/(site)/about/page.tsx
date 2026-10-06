import { Fragment } from "react";
import { JsonLd } from "@/components/JsonLd";
import { ic } from "@/components/Icon";
import { getLive } from "@/lib/live";
import { TEAM } from "@/lib/missions";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { siteDetails } from "@/lib/view";

export const revalidate = 60;
export const metadata = metadataFor("/about");

export default async function AboutPage() {
  const site = siteDetails(await getLive());
  const team = TEAM.map((p, i) => ({ ...p, delay: `${i * 80}ms` }));
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/about"))} />
      <section style={{ width: "100%", maxWidth: "1440px", margin: "0 auto", padding: "clamp(48px,7vw,96px) clamp(20px,4vw,48px)", display: "flex", flexDirection: "column", gap: "40px" }}><div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "860px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: "500", letterSpacing: "0.08em", color: "var(--brand-ink,#C6F534)" }}>WHO WE ARE / 3 PEOPLE, 1 LAB</span><h1 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(40px,5.4vw,68px)", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.025em" }}>Three scientists who think the cake should come second.</h1><p style={{ margin: "0", fontSize: "18px", lineHeight: "28px", color: "var(--muted,#9FACC9)" }}>GROWND is a small team. The person who plans your mission is the person who turns up to run it.</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "24px" }}>{(team).map((p, i1) => (<Fragment key={i1}><article data-reveal="" style={{ transitionDelay: p.delay, borderRadius: "24px", background: "rgba(var(--raised-rgb,27,35,64),0.52)", backdropFilter: "blur(18px) saturate(150%)", WebkitBackdropFilter: "blur(18px) saturate(150%)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.11)", overflow: "hidden" }}><div role="img" aria-label={`Photo to come: ${p.photo}`} style={{ height: "220px", background: p.color, color: "var(--on-accent,#0A0E1A)", padding: "20px", display: "flex", alignItems: "flex-end", fontFamily: "'Space Grotesk',sans-serif", fontSize: "22px", fontWeight: "700" }}>[PHOTO: {p.photo}]</div><div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)", fontWeight: "500" }}>{p.role}</span><h2 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "24px", lineHeight: "30px", fontWeight: "600" }}>{p.name}</h2><p style={{ margin: "0", fontSize: "15px", lineHeight: "24px", color: "var(--muted,#9FACC9)" }}>{p.line}</p></div></article></Fragment>))}</div><div style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "20px 24px", borderRadius: "14px", background: "rgba(var(--surface-rgb,18,24,41),0.55)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: "1px solid var(--hair-strong,#6B7CAB)" }}><span>{ic.info}</span><p style={{ margin: "0", fontSize: "15px", lineHeight: "24px" }}>Safety and checks: {site.insurance}</p></div></section>
    </>
  );
}
