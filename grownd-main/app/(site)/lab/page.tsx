import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { metadataFor, pageSeo, structuredData } from "@/lib/seo";

export const metadata = metadataFor("/lab");

export default function LabPage() {
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/lab"))} />
      <section style={{ width: "100%", maxWidth: "1100px", margin: "0 auto", padding: "clamp(56px,9vw,120px) clamp(20px,4vw,48px)", display: "flex", flexDirection: "column", gap: "24px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: "500", letterSpacing: "0.08em", color: "var(--brand-ink,#C6F534)" }}>THE LAB / OPENING IN PHASE TWO</span><h1 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(44px,6vw,76px)", lineHeight: "0.98", fontWeight: "700", letterSpacing: "-0.025em", maxWidth: "860px" }}>The Lab is still bubbling.</h1><p style={{ margin: "0", maxWidth: "640px", fontSize: "18px", lineHeight: "28px", color: "var(--muted,#9FACC9)" }}>Experiments of the week, home challenges and achievement badges land here after the first missions run. For now, the best experiment on the site is the quiz.</p><div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}><Link href="/quiz" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "12px 24px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontSize: "16px", fontWeight: "700", textDecoration: "none" }}>Start the quiz</Link><Link href="/missions" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "12px 24px", borderRadius: "14px", border: "2px solid var(--hair-strong,#6B7CAB)", color: "var(--ink,#F2F5FF)", fontSize: "16px", fontWeight: "700", textDecoration: "none" }}>Browse all missions</Link></div></section>
    </>
  );
}
