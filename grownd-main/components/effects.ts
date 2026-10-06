// Site-wide motion, set up once by SiteChrome: the custom cursor and magnetic buttons (mouse only),
// the scroll depth tube, ticker skew and hero parallax, sections that fade in as they scroll into
// view (data-reveal), and labels that unscramble (data-scramble). Respects reduced motion.
import type { RefObject } from "react";

interface Refs {
  curRef: RefObject<HTMLDivElement | null>;
  curRing: RefObject<HTMLSpanElement | null>;
  curLabel: RefObject<HTMLSpanElement | null>;
  curDot: RefObject<HTMLDivElement | null>;
  curTxt: RefObject<HTMLSpanElement | null>;
  tubeRef: RefObject<HTMLSpanElement | null>;
  tubeTxt: RefObject<HTMLSpanElement | null>;
  onScroll: (scrolled: boolean, deep: boolean) => void;
}

export function startEffects(r: Refs) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(target: Window | Document, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts);
    cleanups.push(() => target.removeEventListener(type, fn as EventListener));
  };

  // ---- scroll ----
  let lastY = window.scrollY, skewTimer: ReturnType<typeof setTimeout> | undefined;
  const onScroll = () => {
    const y = window.scrollY, d = document.documentElement;
    r.onScroll(y > 12, y > 700);
    const p = Math.max(0, Math.min(1, y / Math.max(1, d.scrollHeight - window.innerHeight)));
    if (r.tubeRef.current) r.tubeRef.current.style.height = `${(p * 100).toFixed(1)}%`;
    if (r.tubeTxt.current) r.tubeTxt.current.textContent = `${String(Math.round(p * 100)).padStart(2, "0")}%`;
    const v = y - lastY;
    lastY = y;
    if (reduced) return;
    const sk = Math.max(-10, Math.min(10, v * 0.35));
    document.querySelectorAll<HTMLElement>("[data-skew]").forEach(el => { el.style.transform = `skewX(${(-sk).toFixed(2)}deg)`; });
    clearTimeout(skewTimer);
    skewTimer = setTimeout(() => document.querySelectorAll<HTMLElement>("[data-skew]").forEach(el => { el.style.transform = "skewX(0deg)"; }), 120);
    document.querySelectorAll<HTMLElement>("[data-parallax]").forEach(el => { el.style.transform = `translateY(${(y * 0.35).toFixed(1)}px)`; });
  };
  on(window, "scroll", onScroll, { passive: true });
  onScroll();

  // ---- cursor and magnetic buttons (mouse only) ----
  if (fine && !reduced) {
    let tx = 0, ty = 0, cx: number | null = null, cy = 0, raf = 0, mode = "";
    let mag: HTMLElement | null = null, magRect: DOMRect | null = null;
    const loop = () => {
      cx = (cx ?? tx) + (tx - (cx ?? tx)) * 0.2;
      cy += (ty - cy) * 0.2;
      if (r.curRef.current) r.curRef.current.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    on(window, "mousemove", e => {
      tx = e.clientX; ty = e.clientY;
      if (cx === null) { cx = tx; cy = ty; }
      if (r.curRef.current) r.curRef.current.style.opacity = "1";
      if (r.curDot.current) { r.curDot.current.style.opacity = "1"; r.curDot.current.style.transform = `translate3d(${tx}px,${ty}px,0)`; }
      if (!raf) raf = requestAnimationFrame(loop);
      const t = e.target instanceof Element ? e.target : null;
      const lab = t?.closest("[data-cursor]"), hot = t?.closest("a,button,select,input,textarea,label");
      const m = lab ? `L${lab.getAttribute("data-cursor")}` : hot ? "H" : "";
      if (m !== mode) {
        mode = m;
        const ring = r.curRing.current;
        if (ring) {
          const size = lab ? 78 : hot ? 56 : 34;
          ring.style.width = ring.style.height = `${size}px`;
          ring.style.background = lab ? "var(--brand,#C6F534)" : hot ? "rgba(198,245,52,0.12)" : "transparent";
        }
        if (r.curLabel.current) r.curLabel.current.textContent = lab ? lab.getAttribute("data-cursor") : "";
      }
      const next = (t?.closest("[data-magnet]") as HTMLElement | null) ?? null;
      if (next !== mag) { if (mag) mag.style.transform = ""; mag = next; magRect = mag?.getBoundingClientRect() ?? null; }
      if (mag && magRect) mag.style.transform = `translate(${((tx - magRect.left - magRect.width / 2) * 0.22).toFixed(1)}px,${((ty - magRect.top - magRect.height / 2) * 0.32).toFixed(1)}px)`;
      if (r.curTxt.current) r.curTxt.current.textContent = `X${String(Math.round(tx)).padStart(4, "0")} Y${String(Math.round(ty)).padStart(4, "0")}`;
    }, { passive: true });
    on(document, "mouseleave", () => {
      if (r.curRef.current) r.curRef.current.style.opacity = "0";
      if (r.curDot.current) r.curDot.current.style.opacity = "0";
    });
    cleanups.push(() => cancelAnimationFrame(raf));
  }

  // ---- reveal on scroll, and scrambled labels ----
  const reveal = reduced || typeof IntersectionObserver === "undefined" ? null
    : new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); reveal?.unobserve(e.target); } }), { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
  const scrambler = reduced || typeof IntersectionObserver === "undefined" ? null
    : new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { scrambler?.unobserve(e.target); scramble(e.target as HTMLElement); } }), { threshold: 0.6 });
  const observe = () => {
    document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in):not([data-ro])").forEach(el => {
      el.setAttribute("data-ro", "");
      if (!reveal) return el.classList.add("is-in");
      const b = el.getBoundingClientRect();
      if (b.top < window.innerHeight && b.bottom > 0) requestAnimationFrame(() => el.classList.add("is-in"));
      else reveal.observe(el);
    });
    if (scrambler) document.querySelectorAll<HTMLElement>("[data-scramble]:not([data-sd])").forEach(el => { el.setAttribute("data-sd", ""); scrambler.observe(el); });
  };
  observe();
  // New content (another page, a filter, a quiz step) brings new elements to watch.
  let pending = 0;
  const mo = new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; observe(); }); });
  mo.observe(document.body, { childList: true, subtree: true });
  cleanups.push(() => { mo.disconnect(); reveal?.disconnect(); scrambler?.disconnect(); cancelAnimationFrame(pending); clearTimeout(skewTimer); });

  return () => cleanups.forEach(fn => fn());
}

function scramble(el: HTMLElement) {
  const fin = el.textContent || "", chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#";
  let f = 0;
  const N = 22;
  const tick = () => {
    f++;
    el.textContent = fin.split("").map((c, i) => (c === " " || c === "/" || i < (fin.length * f) / N ? c : chars[Math.floor(Math.random() * chars.length)])).join("");
    if (f < N) requestAnimationFrame(tick);
    else el.textContent = fin;
  };
  tick();
}
