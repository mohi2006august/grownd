// How missions, dates and prices are shown: the display rules shared by every page.
import type { Live, LiveEvent } from "./live";
import { TYPES, type Mission } from "./missions";

export type Settings = Live["settings"];

/** Site details from the dashboard, with a visible placeholder for anything not filled in yet. */
export function siteDetails(live: Live | null) {
  const s = live?.settings;
  return {
    currency: s?.currency || "[CURRENCY]",
    timezone: s?.timezone || "[TIMEZONE]",
    responseTime: s?.responseTime || "[RESPONSE TIME]",
    insurance: s?.insuranceNote || "[INSURANCE AND DBS DETAILS]"
  };
}

/** A price in the dashboard's currency, formatted for India (₹1,50,000). */
export function money(amount: number, currency: string | undefined) {
  const digits = amount % 1 ? 2 : 0;
  try {
    if (currency) return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: digits }).format(amount);
  } catch { /* unknown currency code: fall through */ }
  return amount.toFixed(digits);
}

export function when(e: Pick<LiveEvent, "date" | "time" | "timezone">) {
  const d = e.date
    ? new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "Date to be confirmed";
  return [d, [e.time, e.timezone].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}

export const cityKey = (c: string | null) =>
  "city-" + ((c || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tbc");

/** Cities with upcoming dates, keyed for the missions filter. */
export function cityMap(live: Live | null) {
  const map: Record<string, string> = {};
  for (const m of Object.values(live?.missions ?? {})) for (const e of m.events) if (e.city) map[cityKey(e.city)] = e.city;
  return map;
}

/** One dated session as shown in lists. */
export function eventView(e: LiveEvent, ages: string) {
  const sold = e.placesLeft === 0;
  return {
    id: e.id,
    when: when(e),
    where: [e.venue, e.city].filter(Boolean).join(", ") || "Venue to be confirmed",
    ck: cityKey(e.city),
    ages, left: e.placesLeft, sold, open: !sold, dated: Boolean(e.date),
    pill: sold ? "Sold out" : `${e.placesLeft} ${e.placesLeft === 1 ? "place" : "places"} left`,
    pillBg: sold ? "var(--danger,#FF7A7A)" : "var(--success,#35D07F)",
    rowBg: sold ? "rgba(var(--surface-rgb,18,24,41),0.45)" : "rgba(var(--raised-rgb,27,35,64),0.55)"
  };
}
export type EventView = ReturnType<typeof eventView> & { bookHref: string };

const NO_EVENT = { where: "Venue to be confirmed", when: "No dates yet", pill: "Register interest", pillBg: "var(--muted,#9FACC9)" };

/** Everything the pages show about one mission, with live price and dates when there are any. */
export function missionView(m: Mission, live: Live | null, i = 0) {
  const t = TYPES[m.type];
  const lv = live?.missions[m.slug];
  const cost = lv?.price != null ? money(lv.price, live?.settings.currency) : "";
  const payable = Boolean(lv && cost && live?.payments.enabled);
  const evs: EventView[] = (lv?.events ?? []).map(e => {
    const v = eventView(e, m.ages);
    return { ...v, bookHref: payable && v.dated && v.open ? `/checkout?event=${v.id}` : `/register/${m.slug}` };
  });
  const next = evs.find(e => e.bookHref.startsWith("/checkout"));
  const first = evs.find(e => e.open) ?? evs[0];
  const insurance = siteDetails(live).insurance;
  return {
    ...m,
    color: t.color, typeName: t.name, typeSlug: t.slug,
    code: `MISSION ${m.no}`, agesText: `AGES ${m.ages}`, lenText: `${m.mins} MIN`, groupText: `UP TO ${m.cap}`,
    price: cost ? `${cost} / ${m.unit}` : "Price on request",
    priceText: cost || "On request", perUnit: cost ? `per ${m.unit}` : "",
    bookHref: next ? next.bookHref : `/register/${m.slug}`,
    payNote: next
      ? "Book a date and pay securely by UPI or card. Want us to come to you instead? Register interest."
      : "No payment at this stage. Register interest sends your details to the GROWND team.",
    worth: m.worth.map(w => (w === "[INSURANCE AND DBS DETAILS]" ? insurance : w)),
    href: `/missions/${m.slug}`, registerHref: `/register/${m.slug}`, resultHref: `/quiz/${t.slug}`,
    delay: `${(i % 3) * 80}ms`,
    evs, ev: first ?? NO_EVENT, hasEvents: evs.length > 0, noEvents: evs.length === 0,
    nextText: first ? first.when : "No dates yet",
    placesText: first ? first.pill : "Register interest",
    placesBg: first ? first.pillBg : "var(--muted,#9FACC9)"
  };
}
export type MissionView = ReturnType<typeof missionView>;

/** "From ₹1,200 / child" for the home page. */
export function fromPrice(live: Live | null, missions: Mission[]) {
  if (!live) return "Price on request";
  const prices = missions.filter(m => m.unit === "child").map(m => live.missions[m.slug]?.price).filter((p): p is number => p != null);
  return prices.length ? `${money(Math.min(...prices), live.settings.currency)} / child` : "Ask us";
}
