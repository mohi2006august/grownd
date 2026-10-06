"use client";
// All missions, filtered by occasion (?cat=birthday) and by city (?city=city-mumbai).
// The server renders the unfiltered list (MissionsList), so the page stays static and search engines
// see every mission; in the browser, MissionsBrowser applies the filter from the address.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, type ChangeEvent } from "react";
import { ic } from "@/components/Icon";
import { MissionCard } from "@/components/MissionCard";
import { CATEGORIES, categoryKey } from "@/lib/missions";
import type { MissionView } from "@/lib/view";
import { css } from "@/lib/css";

type Props = { all: MissionView[]; cities: Record<string, string> };

export function MissionsBrowser(props: Props) {
  const params = useSearchParams();
  return <MissionsList {...props} cat={params.get("cat") || ""} city={params.get("city") || ""} />;
}

export function MissionsList({ all, cities, cat: cq, city: cityParam }: Props & { cat: string; city: string }) {
  const router = useRouter();
  const cityq = cities[cityParam] ? cityParam : "";
  const catName = CATEGORIES.find(c => categoryKey(c[0]) === cq)?.[0] ?? "";
  const list = all.filter(m => (!catName || m.cat === catName) && (!cityq || m.evs.some(e => e.ck === cityq))).map((m, i) => ({ ...m, delay: `${(i % 3) * 80}ms` }));
  const query = (cat: string, city: string) => {
    const parts = [cat && `cat=${cat}`, city && `city=${city}`].filter(Boolean);
    return `/missions${parts.length ? `?${parts.join("&")}` : ""}`;
  };
  const ms = {
    chips: ([["All missions", ""], ...CATEGORIES.map(c => [c[0], categoryKey(c[0])])] as [string, string][]).map(([name, k]) => {
      const on = k === (catName ? cq : "");
      return { name, href: query(k, cityq), current: on ? ("page" as const) : undefined, bg: on ? "var(--brand,#C6F534)" : "transparent", fg: on ? "var(--on-brand,#0A0E1A)" : "var(--ink,#F2F5FF)", border: on ? "var(--brand,#C6F534)" : "var(--hair-strong,#6B7CAB)" };
    }),
    city: cityq,
    cityOptions: Object.entries(cities).map(([k, v]) => <option key={k} value={k}>{v}</option>),
    onCity: (e: ChangeEvent<HTMLSelectElement>) => router.replace(query(catName ? cq : "", e.target.value), { scroll: false }),
    list, hasList: list.length > 0, empty: list.length === 0,
    summary: `SHOWING ${list.length} OF ${all.length}${catName ? ` / ${catName.toUpperCase()}` : ""}${cityq ? ` / ${cities[cityq].toUpperCase()}` : " / ALL CITIES"}`,
    emptyLine: `${catName ? `No ${catName} missions` : "No missions"}${cityq ? ` are scheduled in ${cities[cityq]} yet.` : " are published yet."} Try another city, or register interest and we will tell you the moment one lands.`
  };
  return (
    <section style={{ width: "100%", maxWidth: "1440px", margin: "0 auto", padding: "clamp(40px,6vw,72px) clamp(20px,4vw,48px) clamp(64px,8vw,96px)", display: "flex", flexDirection: "column", gap: "32px" }}><div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: "500", letterSpacing: "0.08em", color: "var(--brand-ink,#C6F534)" }}>MISSIONS / 6 AVAILABLE</span><h1 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(36px,4.6vw,56px)", lineHeight: "1.02", fontWeight: "700", letterSpacing: "-0.02em", textWrap: "balance" }}>Six missions. Pick the one that sounds like your kid.</h1><p style={{ margin: "0", fontSize: "18px", lineHeight: "28px", color: "var(--muted,#9FACC9)" }}>Not sure? <Link href="/quiz" style={{ color: "var(--brand-ink,#C6F534)", fontWeight: "700" }}>Take the two-minute scientist quiz</Link> and we will point you at the right one.</p></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px 24px", flexWrap: "wrap", padding: "16px 0", borderTop: "1px solid var(--hair,#2C3757)", borderBottom: "1px solid var(--hair,#2C3757)" }}><nav aria-label="Filter by category" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>{(ms.chips).map((c, i1) => (<Fragment key={i1}><Link className="ms0-1" href={c.href} aria-current={c.current} style={css({ display: "inline-flex", alignItems: "center", minHeight: "44px", padding: "8px 18px", borderRadius: "999px", background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontSize: "15px", fontWeight: "600", textDecoration: "none", transition: "border-color 150ms ease,background 150ms ease", "--ms0-1-1": c.fg })}>{c.name}</Link></Fragment>))}</nav><label style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)", fontWeight: "500" }}>CITY</span><span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}><select value={ms.city} onChange={ms.onCity} style={{ appearance: "none", minHeight: "48px", minWidth: "200px", padding: "0 44px 0 16px", borderRadius: "8px", border: "1px solid var(--hair-strong,#6B7CAB)", background: "rgba(var(--deep-rgb,10,14,26),0.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "var(--ink,#F2F5FF)", fontSize: "16px", cursor: "pointer" }}><option value="">All cities</option>{ms.cityOptions}</select><span style={{ position: "absolute", right: "14px", pointerEvents: "none", display: "inline-flex" }}>{ic.chev}</span></span></label></div><p aria-live="polite" style={{ margin: "-12px 0 0", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)", fontWeight: "500" }}>{ms.summary}</p>{(ms.hasList) && (<><h2 className="gr-sr">The missions</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,340px),1fr))", gap: "clamp(20px,2.4vw,32px)" }}>{(ms.list).map((item, i2) => (<Fragment key={i2}><div data-reveal="" style={{ transitionDelay: item.delay }}><MissionCard m={item} /></div></Fragment>))}</div></>)}{(ms.empty) && (<><div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "16px", padding: "clamp(40px,6vw,72px) 24px", borderRadius: "24px", background: "rgba(var(--surface-rgb,18,24,41),0.5)", backdropFilter: "blur(18px) saturate(150%)", WebkitBackdropFilter: "blur(18px) saturate(150%)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.09)" }}><span style={{ width: "72px", height: "72px", borderRadius: "24px", border: "1px solid var(--hair-strong,#6B7CAB)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{ic.flask}</span><h2 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,3vw,36px)", lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.01em" }}>Nothing in that category yet</h2><p style={{ margin: "0", maxWidth: "520px", fontSize: "16px", lineHeight: "26px", color: "var(--muted,#9FACC9)" }}>{ms.emptyLine}</p><div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}><Link href="/missions" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "12px 24px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontSize: "16px", fontWeight: "700", textDecoration: "none" }}>Show all missions</Link><Link href="/register" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "12px 24px", borderRadius: "14px", border: "2px solid var(--hair-strong,#6B7CAB)", color: "var(--ink,#F2F5FF)", fontSize: "16px", fontWeight: "700", textDecoration: "none" }}>Register interest</Link></div></div></>)}<div data-reveal="" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", flexWrap: "wrap", padding: "clamp(28px,4vw,48px) clamp(24px,4vw,56px)", borderRadius: "24px", background: "rgba(var(--surface-rgb,18,24,41),0.5)", backdropFilter: "blur(18px) saturate(150%)", WebkitBackdropFilter: "blur(18px) saturate(150%)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.09)", marginTop: "16px" }}><div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><h2 style={{ margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(26px,3vw,36px)", lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.01em" }}>Still scrolling? Let the quiz decide.</h2><p style={{ margin: "0", fontSize: "16px", lineHeight: "26px", color: "var(--muted,#9FACC9)" }}>Six questions, two minutes, one mission that fits.</p></div><Link className="ms0-2" href="/quiz" style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "52px", padding: "12px 24px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontSize: "16px", fontWeight: "700", textDecoration: "none" }}>Start the quiz {ic.arrow}</Link></div></section>
  );
}
