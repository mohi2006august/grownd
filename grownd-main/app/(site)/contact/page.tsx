import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { getLive } from "@/lib/live";
import { SITE_URL, metadataFor, pageSeo, structuredData } from "@/lib/seo";
import { siteDetails } from "@/lib/view";

export const revalidate = 60;
export const metadata = metadataFor("/contact");

const mono = { fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: "500", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)" };
const card = { display: "flex", flexDirection: "column" as const, gap: "8px", padding: "24px", borderRadius: "20px", background: "rgba(var(--raised-rgb,27,35,64),0.52)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.11)", minWidth: "0" };
const value = { margin: "0", fontSize: "19px", lineHeight: "28px", fontWeight: "600", color: "var(--ink,#F2F5FF)", overflowWrap: "anywhere" as const };

export default async function ContactPage() {
  const s = siteDetails(await getLive());
  const contact = {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "GROWND",
    ...(s.hasEmail && { email: s.email }), ...(s.hasPhone && { telephone: s.phone }),
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", areaServed: "IN", availableLanguage: ["en", "hi"], ...(s.hasEmail && { email: s.email }), ...(s.hasPhone && { telephone: s.phone }) }
  };
  return (
    <>
      <JsonLd data={structuredData(pageSeo("/contact"))} />
      <JsonLd data={contact} />
      <section style={{ width: "100%", maxWidth: "1100px", margin: "0 auto", padding: "clamp(48px,7vw,96px) clamp(20px,4vw,48px)", display: "flex", flexDirection: "column", gap: "40px" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "760px" }}>
          <span style={{ ...mono, fontSize: "13px", color: "var(--brand-ink,#C6F534)" }}>CONTACT / A REAL PERSON REPLIES</span>
          <h1 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(40px,5.4vw,64px)", lineHeight: "1", fontWeight: "700", letterSpacing: "-0.025em" }}>Talk to the GROWND team</h1>
          <p style={{ margin: "0", fontSize: "19px", lineHeight: "30px", color: "var(--muted,#9FACC9)" }}>Questions about a party, a workshop or a school visit? Write or call, and the person who would run your mission replies within {s.responseTime}.</p>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: "20px" }}>
          <div style={card}><span style={mono}>EMAIL</span>{s.hasEmail ? <a href={`mailto:${s.email}`} style={{ ...value, color: "var(--brand-ink,#C6F534)" }}>{s.email}</a> : <p style={value}>{s.email}</p>}</div>
          <div style={card}><span style={mono}>PHONE</span>{s.hasPhone ? <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} style={{ ...value, color: "var(--brand-ink,#C6F534)" }}>{s.phone}</a> : <p style={value}>{s.phone}</p>}</div>
          <div style={card}><span style={mono}>ADDRESS</span><p style={{ ...value, fontSize: "17px", whiteSpace: "pre-line" }}>{s.businessName}{"\n"}{s.address}</p></div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <Link href="/register" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "12px 24px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontSize: "16px", fontWeight: "700", textDecoration: "none" }}>Register interest</Link>
          <Link href="/missions" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "12px 24px", borderRadius: "14px", border: "2px solid var(--hair-strong,#6B7CAB)", color: "var(--ink,#F2F5FF)", fontSize: "16px", fontWeight: "700", textDecoration: "none" }}>Browse missions</Link>
        </div>
        <p style={{ margin: "0", fontSize: "15px", lineHeight: "24px", color: "var(--muted,#9FACC9)" }}>Before you book: <Link href="/terms" style={{ color: "inherit", textDecoration: "underline" }}>terms and conditions</Link>, <Link href="/refunds" style={{ color: "inherit", textDecoration: "underline" }}>cancellation and refund policy</Link> and <Link href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>privacy policy</Link>.</p>
      </section>
    </>
  );
}
