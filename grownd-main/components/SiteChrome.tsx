"use client";
// The frame around every page: background, header, menu, breadcrumbs and footer, plus the site's
// motion (custom cursor, magnetic buttons, scroll depth tube, reveal-on-scroll, page wipe).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { MISSIONS, TYPES, missionBySlug, typeBySlug } from "@/lib/missions";
import { ic } from "./Icon";
import { startEffects } from "./effects";
import { css } from "@/lib/css";

type Section = "missions" | "quiz" | "lab" | "who";
const NAV: [Section, string, string][] = [["missions", "Missions", "/missions"], ["quiz", "Scientist quiz", "/quiz"], ["lab", "The Lab", "/lab"], ["who", "Who we are", "/about"]];

function sectionOf(path: string): Section | null {
  if (path.startsWith("/missions") || path.startsWith("/register")) return "missions";
  if (path.startsWith("/quiz")) return "quiz";
  if (path === "/lab") return "lab";
  if (path === "/about") return "who";
  return null;
}

/** Where a page sits: its breadcrumbs, the page "up a level", and the colour that tints the background. */
function placeOf(path: string) {
  const [, first = "", id] = path.split("/");
  const L = (label: string, href?: string) => ({ label, href });
  const brand = "var(--brand,#C6F534)";
  if (path === "/") return { crumbs: [], parent: "/", theme: brand };
  if (first === "missions" && id) {
    const m = missionBySlug(id);
    if (m) return { crumbs: [L("MISSIONS", "/missions"), L(m.title.toUpperCase())], parent: "/missions", theme: TYPES[m.type].color };
  }
  if (first === "quiz" && id) {
    const k = typeBySlug(id);
    if (k) return { crumbs: [L("SCIENTIST QUIZ", "/quiz"), L(`RESULT / ${TYPES[k].name.toUpperCase()}`)], parent: "/quiz", theme: TYPES[k].color };
  }
  if (first === "register") {
    const m = id ? missionBySlug(id) : undefined;
    if (m) return { crumbs: [L("MISSIONS", "/missions"), L(m.title.toUpperCase(), `/missions/${m.slug}`), L("REGISTER INTEREST")], parent: `/missions/${m.slug}`, theme: TYPES[m.type].color };
    if (!id) return { crumbs: [L("MISSIONS", "/missions"), L("REGISTER INTEREST")], parent: "/missions", theme: brand };
  }
  if (!id) {
    const simple: Record<string, string> = { missions: "MISSIONS", quiz: "SCIENTIST QUIZ", lab: "THE LAB", about: "WHO WE ARE", contact: "CONTACT", terms: "TERMS AND CONDITIONS", privacy: "PRIVACY POLICY", refunds: "CANCELLATION AND REFUNDS" };
    if (simple[first]) return { crumbs: [L(simple[first])], parent: "/", theme: brand };
    if (first === "thank-you") return { crumbs: [L("REGISTER INTEREST", "/register"), L("DETAILS RECEIVED")], parent: "/", theme: "var(--success,#35D07F)" };
  }
  return { crumbs: [L("ERROR 404")], parent: "/", theme: brand };
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [deep, setDeep] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const navCount = useRef(0);
  const firstPath = useRef(path);
  const mainRef = useRef<HTMLElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const refs = { curRef: useRef<HTMLDivElement>(null), curRing: useRef<HTMLSpanElement>(null), curLabel: useRef<HTMLSpanElement>(null), curDot: useRef<HTMLDivElement>(null), curTxt: useRef<HTMLSpanElement>(null), tubeRef: useRef<HTMLSpanElement>(null), tubeTxt: useRef<HTMLSpanElement>(null) };

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll, mouse, reveal and scramble effects for the whole site.
  useEffect(() => {
    (window as Window & { __grReady?: boolean }).__grReady = true;
    setTheme(document.documentElement.classList.contains("gr-light") ? "light" : "dark");
    return startEffects({ ...refs, onScroll: (s, d) => { setScrolled(s); setDeep(d); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new page: close the menu, play the wipe and fade the page in, and look for new reveal elements.
  useEffect(() => {
    setMenu(false);
    if (path === firstPath.current && navCount.current === 0) return;
    navCount.current++;
    if (reduced()) return;
    wipeRef.current?.animate([{ transform: "translateY(0%)" }, { transform: "translateY(0%)", offset: 0.25 }, { transform: "translateY(-100%)" }], { duration: 560, easing: "cubic-bezier(.7,0,.2,1)" });
    mainRef.current?.animate([{ opacity: 0, transform: "translateY(24px)" }, { opacity: 0, transform: "translateY(24px)", offset: 0.35 }, { opacity: 1, transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,.7,.2,1)" });
  }, [path]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", onKey);
    if (!reduced() && menuRef.current) Array.from(menuRef.current.children).forEach((c, i) => c.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: i * 45, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" }));
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  function toggleTheme(e: MouseEvent) {
    const next = theme === "light" ? "dark" : "light";
    const apply = () => {
      document.documentElement.classList.toggle("gr-light", next === "light");
      try { localStorage.setItem("grownd-theme", next); } catch { /* private mode */ }
      setTheme(next);
    };
    const x = e.clientX || window.innerWidth - 80, y = e.clientY || 40;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || reduced()) return apply();
    doc.startViewTransition(apply).ready.then(() => {
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 700, easing: "cubic-bezier(.7,0,.2,1)", pseudoElement: "::view-transition-new(root)" });
    }).catch(() => {});
  }

  const place = placeOf(path);
  const active = sectionOf(path);
  const nav = NAV.map(([k, label, href], i) => {
    const on = active === k;
    return { label, href, num: `0${i + 1}`, current: on ? ("page" as const) : undefined, color: on ? "var(--ink,#F2F5FF)" : "var(--muted,#9FACC9)", bg: on ? "var(--raised,#1B2340)" : "transparent", dot: on ? "var(--brand,#C6F534)" : "transparent" };
  });
  const lay = {
    theme: place.theme,
    headerBg: scrolled || menu ? "rgba(var(--surface-rgb,18,24,41),0.86)" : "rgba(var(--surface-rgb,18,24,41),0.45)",
    headerBorder: scrolled || menu ? "var(--hair,#2C3757)" : "rgba(44,55,87,0.6)",
    headerShadow: scrolled ? "0 12px 32px rgba(var(--shadow-rgb,4,7,16),0.5)" : "none"
  };
  const crumbs = {
    show: path !== "/",
    backLabel: navCount.current > 0 ? "Back" : "Up a level",
    items: [{ label: "LAB", href: "/" }, ...place.crumbs].map((c, i, all) => ({ ...c, link: Boolean(c.href) && i < all.length - 1, here: i === all.length - 1, sep: i ? "inline" : "none" }))
  };
  const goBack = () => (navCount.current > 0 ? router.back() : router.push(place.parent));
  const toTop = () => window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
  const skip = (e: MouseEvent) => { e.preventDefault(); mainRef.current?.focus(); };
  const { curRef, curRing, curLabel, curDot, curTxt, tubeRef, tubeTxt } = refs;
  const themeIcon = theme === "light" ? ic.moon : ic.sun;

  return (
    <div className="gr-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--deep,#0A0E1A)", color: "var(--ink,#F2F5FF)" }}>
      <div ref={wipeRef} aria-hidden="true" style={{ position: "fixed", inset: "0", zIndex: "90", pointerEvents: "none", background: "var(--surface,#121829)", borderTop: "4px solid var(--brand-ink,#C6F534)", transform: "translateY(100%)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", fontWeight: "500", color: "var(--brand-ink,#C6F534)" }}>LOADING SAMPLE</span></div>
      <div aria-hidden="true" style={{ position: "fixed", inset: "0", zIndex: "0", pointerEvents: "none", overflow: "hidden" }}><div style={{ position: "absolute", inset: "0", backgroundImage: "linear-gradient(rgba(107,124,171,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(107,124,171,0.06) 1px,transparent 1px)", backgroundSize: "56px 56px" }}></div><span className="gr-anim" style={{ position: "absolute", left: "-10%", top: "-15%", width: "55vw", height: "55vw", maxWidth: "760px", maxHeight: "760px", borderRadius: "50%", background: lay.theme, opacity: "0.13", filter: "blur(120px)", animation: "grBlobA 24s ease-in-out infinite", transition: "background 900ms ease" }}></span><span className="gr-anim" style={{ position: "absolute", right: "-12%", top: "25%", width: "50vw", height: "50vw", maxWidth: "700px", maxHeight: "700px", borderRadius: "50%", background: "var(--phys,#38BDF8)", opacity: "0.09", filter: "blur(120px)", animation: "grBlobB 28s ease-in-out infinite" }}></span><span className="gr-anim" style={{ position: "absolute", left: "25%", bottom: "-25%", width: "50vw", height: "50vw", maxWidth: "700px", maxHeight: "700px", borderRadius: "50%", background: "var(--chem,#FF5CA8)", opacity: "0.08", filter: "blur(120px)", animation: "grBlobA 32s ease-in-out -10s infinite" }}></span></div>
      {deep && <button className="hifdeep-1" type="button" onClick={toTop} aria-label="Back to top" style={css({ position: "fixed", right: "var(--lay-top-right)", bottom: "var(--lay-top-bottom)", zIndex: "40", width: "52px", height: "52px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--raised-rgb,27,35,64),0.6)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.16)", color: "var(--ink,#F2F5FF)", cursor: "pointer", boxShadow: "0 12px 32px rgba(var(--shadow-rgb,4,7,16),0.5)", transition: "transform 200ms ease,background 200ms ease" })}>{ic.arrowUp}</button>}
      <div ref={curRef} className="gr-cursor" aria-hidden="true" style={{ position: "fixed", left: "0", top: "0", zIndex: "95", pointerEvents: "none", width: "0", height: "0", opacity: "0", transition: "opacity 200ms ease" }}><span ref={curRing} style={{ position: "absolute", left: "0", top: "0", width: "34px", height: "34px", transform: "translate(-50%,-50%)", border: "1.5px solid var(--brand-ink,#C6F534)", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", color: "var(--on-brand,#0A0E1A)", transition: "width 250ms cubic-bezier(.2,.7,.2,1),height 250ms cubic-bezier(.2,.7,.2,1),background 200ms ease" }}><span ref={curLabel}></span></span></div>
      <div ref={curDot} className="gr-cursor" aria-hidden="true" style={{ position: "fixed", left: "0", top: "0", zIndex: "96", pointerEvents: "none", width: "0", height: "0", opacity: "0", transition: "opacity 200ms ease" }}><span style={{ position: "absolute", left: "-3px", top: "-3px", width: "6px", height: "6px", borderRadius: "999px", background: "var(--brand,#C6F534)", boxShadow: "0 0 0 2px var(--deep,#0A0E1A)" }}></span><span ref={curTxt} style={{ position: "absolute", left: "24px", top: "18px", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: "0.08em", color: "var(--brand-ink,#C6F534)" }}></span></div>
      <div aria-hidden="true" style={css({ position: "fixed", right: "18px", top: "50%", transform: "translateY(-50%)", zIndex: "30", pointerEvents: "none", display: "var(--lay-tube-display)", flexDirection: "column", alignItems: "center", gap: "8px" })}><span ref={tubeTxt} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: "0.08em", color: "var(--brand-ink,#C6F534)" }}>00%</span><span style={{ width: "22px", height: "6px", borderRadius: "6px", background: "var(--hair-strong,#6B7CAB)" }}></span><span style={{ position: "relative", width: "14px", height: "160px", marginTop: "-8px", border: "2px solid var(--hair-strong,#6B7CAB)", borderTop: "0", borderRadius: "0 0 999px 999px", overflow: "hidden", background: "rgba(var(--surface-rgb,18,24,41),0.6)" }}><span ref={tubeRef} style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "0%", background: "var(--brand,#C6F534)", transition: "height 120ms linear" }}></span></span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)", writingMode: "vertical-rl" }}>DEPTH</span></div>
      <a className="ha6-1" href="#main" onClick={skip} style={{ position: "fixed", left: "16px", top: "-80px", zIndex: "100", padding: "12px 16px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontWeight: "700", fontSize: "15px", textDecoration: "none" }}>Skip to content</a>

      <header style={{ position: "sticky", top: "0", zIndex: "50", padding: "12px clamp(12px,2vw,24px) 0" }}><div style={{ maxWidth: "1392px", margin: "0 auto", height: "64px", padding: "0 8px 0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderRadius: "999px", background: lay.headerBg, border: `1px solid ${lay.headerBorder}`, boxShadow: lay.headerShadow, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", transition: "background 300ms ease,border-color 300ms ease,box-shadow 300ms ease" }}><Link href="/" aria-label="GROWND home" style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "44px", textDecoration: "none" }}><span className="hheader7-1" aria-hidden="true" style={{ width: "34px", height: "34px", borderRadius: "10px", background: "var(--brand,#C6F534)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--on-brand,#0A0E1A)", transition: "transform 300ms cubic-bezier(.2,.7,.2,1)" }}>{ic.flaskS}</span><span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "22px", fontWeight: "700", letterSpacing: "0.06em", color: "var(--brand-ink,#C6F534)" }}>GROWND</span></Link><nav aria-label="Main" style={css({ display: "var(--lay-nav-display)", gap: "2px", padding: "4px", borderRadius: "999px", background: "rgba(var(--deep-rgb,10,14,26),0.55)", border: "1px solid var(--hair,#2C3757)" })}>{nav.map(n => (<Link key={n.href} className="hheader7-2" href={n.href} aria-current={n.current} style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "0 16px", borderRadius: "999px", fontSize: "15px", fontWeight: "600", color: n.color, background: n.bg, textDecoration: "none", transition: "color 150ms ease,background 150ms ease" }}><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: n.dot }}></span>{n.label}</Link>))}</nav><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><button className="hheader7-3" type="button" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to Lab theme (dark)" : "Switch to Daylight theme (light)"} aria-pressed={theme === "light"} data-cursor={theme === "light" ? "NIGHT" : "DAY"} style={{ width: "48px", height: "48px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", border: "1px solid var(--hair-strong,#6B7CAB)", background: "var(--raised,#1B2340)", color: "var(--ink,#F2F5FF)", cursor: "pointer", transition: "transform 400ms cubic-bezier(.2,.7,.2,1)" }}>{themeIcon}</button><Link className="hheader7-4" data-magnet="" href="/register" style={css({ display: "var(--lay-cta-display)", alignItems: "center", gap: "8px", minHeight: "48px", padding: "10px 18px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontSize: "15px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap", transition: "box-shadow 150ms ease,transform 150ms ease" })}>Book a science experience {ic.arrow}</Link><button type="button" onClick={() => setMenu(m => !m)} aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="gr-menu" style={css({ display: "var(--lay-burger-display)", width: "48px", height: "48px", alignItems: "center", justifyContent: "center", borderRadius: "999px", border: "1px solid var(--hair-strong,#6B7CAB)", background: "var(--raised,#1B2340)", color: "var(--ink,#F2F5FF)", cursor: "pointer" })}>{menu ? ic.close : ic.menu}</button></div></div></header>

      {menu && <div id="gr-menu" style={{ position: "fixed", inset: "0", zIndex: "45", background: "rgba(var(--deep-rgb,10,14,26),0.82)", backdropFilter: "blur(24px) saturate(150%)", WebkitBackdropFilter: "blur(24px) saturate(150%)", overflow: "auto", padding: "100px 20px 32px" }}><nav ref={menuRef} aria-label="Main" style={{ display: "flex", flexDirection: "column" }}>{nav.map(n => (<Link key={n.href} href={n.href} aria-current={n.current} style={{ minHeight: "72px", display: "flex", alignItems: "center", gap: "16px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "36px", fontWeight: "700", letterSpacing: "-0.02em", color: n.color, textDecoration: "none", borderBottom: "1px solid var(--hair,#2C3757)" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)", fontWeight: "500" }}>{n.num}</span>{n.label}<span style={{ marginLeft: "auto", color: "var(--brand-ink,#C6F534)" }}>{ic.arrow}</span></Link>))}<Link href="/register" style={{ marginTop: "28px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "56px", borderRadius: "14px", background: "var(--brand,#C6F534)", color: "var(--on-brand,#0A0E1A)", fontSize: "17px", fontWeight: "700", textDecoration: "none" }}>Book a science experience</Link><Link href="/quiz" style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "56px", borderRadius: "14px", border: "2px solid var(--hair-strong,#6B7CAB)", color: "var(--ink,#F2F5FF)", fontSize: "17px", fontWeight: "700", textDecoration: "none" }}>Start the quiz</Link><p style={{ margin: "28px 0 0", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)" }}>AGES 5-12 / 90-120 MIN / WE BRING EVERYTHING</p></nav></div>}

      <main id="main" tabIndex={-1} ref={mainRef} style={{ position: "relative", zIndex: "1", flex: "1", outline: "none" }}>
        {crumbs.show && <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "20px clamp(20px,4vw,48px) 0", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}><button className="humbsshow-1" type="button" onClick={goBack} data-magnet="1" style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", padding: "8px 18px 8px 12px", borderRadius: "999px", background: "rgba(var(--raised-rgb,27,35,64),0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(var(--ink-rgb,242,245,255),0.14)", color: "var(--ink,#F2F5FF)", fontSize: "15px", fontWeight: "700", cursor: "pointer", transition: "background 150ms ease,transform 150ms ease" }}>{ic.arrowL} {crumbs.backLabel}</button><nav aria-label="Breadcrumb"><ol style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: "0.08em", fontWeight: "500" }}>{crumbs.items.map((c, i) => (<Fragment key={i}><li style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span aria-hidden="true" style={{ color: "var(--hair-strong,#6B7CAB)", display: c.sep }}>/</span>{c.link && c.href && <Link className="humbsshow-2" href={c.href} style={{ display: "inline-flex", alignItems: "center", minHeight: "44px", padding: "0 6px", color: "var(--muted,#9FACC9)", textDecoration: "none", borderRadius: "8px" }}>{c.label}</Link>}{c.here && <span aria-current="page" style={{ padding: "0 6px", color: "var(--brand-ink,#C6F534)" }}>{c.label}</span>}</li></Fragment>))}</ol></nav></div>}
        {children}
      </main>

      <footer style={{ position: "relative", zIndex: "1", borderTop: "1px solid rgba(var(--ink-rgb,242,245,255),0.10)", background: "rgba(var(--surface-rgb,18,24,41),0.6)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}><div style={{ width: "100%", maxWidth: "1440px", margin: "0 auto", padding: "clamp(48px,6vw,72px) clamp(20px,4vw,48px) 40px", display: "flex", flexDirection: "column", gap: "32px" }}><div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "32px", alignItems: "flex-start" }}><div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "440px" }}><Link href="/" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: "44px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "28px", fontWeight: "700", letterSpacing: "0.04em", color: "var(--brand-ink,#C6F534)", textDecoration: "none" }}>GROWND</Link><p style={{ margin: "0", fontSize: "14px", lineHeight: "22px", color: "var(--muted,#9FACC9)" }}>Run by [TEAM LEAD] on science and experience, [TECH LEAD] on technology and [CONTENT LEAD] on content. Real experiments for ages 5 to 12.</p></div><nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "0 24px" }}>{([["/missions", "Missions"], ["/quiz", "Scientist quiz"], ["/lab", "The Lab"], ["/about", "Who we are"], ["/register", "Register interest"]] as const).map(([href, label], i) => (<Link key={href} className={`hfooter8-${i + 1}`} href={href} style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", fontSize: "15px", fontWeight: "600", color: "var(--ink,#F2F5FF)", textDecoration: "none" }}>{label}</Link>))}</nav></div><nav aria-label="Missions" style={{ display: "flex", flexWrap: "wrap", gap: "0 20px" }}>{MISSIONS.map(m => (<Link key={m.slug} href={`/missions/${m.slug}`} style={{ minHeight: "40px", display: "inline-flex", alignItems: "center", fontSize: "14px", color: "var(--muted,#9FACC9)", textDecoration: "none" }}>{m.title}</Link>))}</nav><div style={{ paddingTop: "24px", borderTop: "1px solid var(--hair,#2C3757)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px 32px" }}><p style={{ margin: "0", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", lineHeight: "18px", fontWeight: "500", letterSpacing: "0.08em", color: "var(--muted,#9FACC9)" }}>PAYMENTS ARE HANDLED BY RAZORPAY. GROWND NEVER SEES YOUR CARD OR UPI DETAILS.</p><nav aria-label="Contact and policies" style={{ display: "flex", flexWrap: "wrap", gap: "0 20px" }}>{([["/contact", "Contact"], ["/terms", "Terms"], ["/privacy", "Privacy"], ["/refunds", "Cancellation and refunds"]] as const).map(([href, label]) => (<Link key={href} className="gr-foot-link" href={href} style={{ minHeight: "40px", display: "inline-flex", alignItems: "center", fontSize: "14px", color: "var(--muted,#9FACC9)", textDecoration: "none" }}>{label}</Link>))}</nav></div></div><div aria-hidden="true" style={{ overflow: "hidden", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "clamp(88px,21vw,320px)", lineHeight: "0.78", letterSpacing: "-0.05em", textAlign: "center", color: "transparent", WebkitTextStroke: "1.5px rgba(var(--ink-rgb,242,245,255),0.14)", marginBottom: "-0.06em", userSelect: "none", whiteSpace: "nowrap" }}>GROWND</div></footer>
    </div>
  );
}
