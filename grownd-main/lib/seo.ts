// Search and sharing copy for every page: titles, descriptions, share images and structured data.
// Search titles stay under about 60 characters and descriptions under about 160, or Google cuts them.
import type { Metadata } from "next";
import { MISSIONS, TYPES, TYPE_ORDER, type Category, type Mission } from "./missions";

export const site = {
  name: "GROWND",
  lang: "en-IN",
  locale: "en_IN",
  country: "India",
  themeColor: "#0A0E1A",
  description:
    "Hands-on science parties, workshops, school events and coding sessions for children aged 5 to 12. We bring the kit, the scientists and the clean-up.",
  // Fill these in once they exist. Search engines use them to connect GROWND's profiles.
  email: "",
  sameAs: [] as string[] // for example "https://www.instagram.com/grownd"
};

/** The site's public address: SITE_URL, else Vercel's production domain, else localhost. */
export const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:4000")
).replace(/\/+$/, "");

type Kind = "WebPage" | "CollectionPage" | "AboutPage";
type Crumb = [name: string, path?: string];

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  /** Indexable pages are listed in the sitemap; the rest carry noindex. */
  index: boolean;
  /** Share image name in public/og/. */
  image: string;
  imageAlt: string;
  kind: Kind;
  crumbs: Crumb[];
  service?: { name: string; serviceType: string; description: string; ages: string };
}

const MISSION_COPY: Record<string, { title: string; description: string }> = {
  "slime-chemistry": {
    title: "Slime Chemistry Science Birthday Party, Ages 5-8",
    description: "A 90-minute slime chemistry party for ages 5-8. Kids mix polymers, test their slime and take home a pot and recipe card. We bring everything."
  },
  "rocket-engineering": {
    title: "Rocket Engineering Workshop for Kids, Ages 7-11",
    description: "Two hours of rocket design for ages 7-11: build a rocket, launch it on a pressure launcher, then improve it. All kit and two scientists included."
  },
  "crime-scene-biology": {
    title: "Crime Scene Biology: Forensic Science for Schools",
    description: "Forensic science for a whole class, ages 8-12. Pupils lift fingerprints, compare fibres and solve a staged crime together. Up to 32 per session."
  },
  "light-and-lasers": {
    title: "Light and Lasers Science Workshop, Ages 7-12",
    description: "A 90-minute light workshop for ages 7-12: split white light, bend a laser through water and race a mirror maze. Safe, fully supervised lasers."
  },
  "build-a-game-in-scratch": {
    title: "Build a Game in Scratch: Coding for Kids 8-12",
    description: "Kids aged 8-12 build a playable Scratch game in two hours, with a score, a timer and sound. No coding experience needed. Everyone leaves with a link."
  },
  "glow-lab": {
    title: "Glow Lab: Dry Ice and UV Science Party, Ages 5-10",
    description: "Our seasonal science party for ages 5-10: dry ice fog, UV paint and colour-change reactions in a dark room. Every child takes home a glow badge."
  }
};

const SERVICE_TYPE: Record<Category, string> = {
  Birthday: "Children's science birthday party",
  "Private celebration": "Private children's science party",
  Workshop: "Children's science workshop",
  "School event": "School science workshop",
  Coding: "Children's coding workshop",
  "Seasonal event": "Children's seasonal science event"
};

/** Shortens text to whole sentences (or words) within `max` characters. */
export function clip(text: string, max = 158) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

function missionPage(m: Mission): PageSeo {
  const copy = MISSION_COPY[m.slug] ?? { title: `${m.title}: ${SERVICE_TYPE[m.cat]}, Ages ${m.ages}`, description: clip(`${m.line} ${m.para}`) };
  return {
    path: `/missions/${m.slug}`, title: `${copy.title} | GROWND`, description: copy.description, index: true,
    image: m.slug, imageAlt: `${m.title} by GROWND: ${m.cat.toLowerCase()} for ages ${m.ages}`, kind: "WebPage",
    crumbs: [["Missions", "/missions"], [m.title]],
    service: { name: m.title, serviceType: SERVICE_TYPE[m.cat], description: m.para, ages: m.ages }
  };
}

function registerPage(m?: Mission): PageSeo {
  return {
    path: m ? `/register/${m.slug}` : "/register",
    title: m ? `Register Interest: ${m.title} | GROWND` : "Register Interest | GROWND",
    description: "Tell us who is coming and a real person replies with dates, a price and the logistics. No payment at this stage.",
    index: false, image: m ? m.slug : "default", imageAlt: m ? `${m.title} by GROWND` : "GROWND", kind: "WebPage",
    crumbs: m ? [["Missions", "/missions"], [m.title, `/missions/${m.slug}`], ["Register interest"]] : [["Register interest"]]
  };
}

export const PAGES: PageSeo[] = [
  {
    path: "/", title: "GROWND | Science Parties and STEM Workshops for Kids 5-12",
    description: "Hands-on science for ages 5-12: birthday parties, workshops, school events and coding. We bring the kit, the scientists and the clean-up.",
    index: true, image: "default", imageAlt: "GROWND: every child is a scientist. Some just need a lab.", kind: "WebPage", crumbs: []
  },
  {
    path: "/missions", title: "Science Missions for Kids Aged 5-12 | GROWND",
    description: "Six hands-on missions: slime chemistry, rockets, forensic biology, lasers, Scratch coding and a glow lab. Find the right one for your child.",
    index: true, image: "default", imageAlt: "GROWND science missions for children aged 5 to 12", kind: "CollectionPage", crumbs: [["Missions"]]
  },
  ...MISSIONS.map(missionPage),
  {
    path: "/quiz", title: "What Kind of Scientist Is Your Child? Free Quiz | GROWND",
    description: "Six questions, two minutes, four scientist types. Find out if your child is a biologist, chemist, physicist or engineer, and which mission suits them.",
    index: true, image: "quiz", imageAlt: "The GROWND scientist quiz: what kind of scientist is your child?", kind: "WebPage", crumbs: [["Scientist quiz"]]
  },
  ...TYPE_ORDER.map((k): PageSeo => {
    const t = TYPES[k];
    return {
      path: `/quiz/${t.slug}`, title: `Is Your Child ${t.an} ${t.name}? Science Missions to Match | GROWND`,
      description: clip(t.desc), index: true, image: t.slug, imageAlt: `GROWND scientist type: ${t.name}. ${t.tag}`, kind: "WebPage",
      crumbs: [["Scientist quiz", "/quiz"], [t.name]]
    };
  }),
  {
    path: "/about", title: "Who We Are | GROWND Science Experiences for Kids",
    description: "GROWND is a small team running hands-on STEM missions for children aged 5-12. The person who plans your mission is the person who turns up to run it.",
    index: true, image: "default", imageAlt: "The GROWND team", kind: "AboutPage", crumbs: [["Who we are"]]
  },
  // Thin or private pages: reachable, but kept out of search results.
  {
    path: "/lab", title: "The Lab: Experiments for Young Scientists | GROWND",
    description: "Experiments of the week, home challenges and achievement badges for young scientists. Opening after the first GROWND missions run.",
    index: false, image: "default", imageAlt: "The GROWND Lab", kind: "WebPage", crumbs: [["The Lab"]]
  },
  registerPage(),
  ...MISSIONS.map(registerPage),
  {
    path: "/thank-you", title: "Thanks, We Have Your Details | GROWND",
    description: "Your details are with the GROWND team. A real person replies with dates, a price and a couple of questions about the room.",
    index: false, image: "default", imageAlt: "GROWND", kind: "WebPage", crumbs: [["Details received"]]
  }
];

const BY_PATH = new Map(PAGES.map(p => [p.path, p]));
export const pageSeo = (path: string) => {
  const page = BY_PATH.get(path);
  if (!page) throw new Error(`No SEO entry for ${path}: add it to PAGES in lib/seo.ts`);
  return page;
};

export const ogImage = (name: string) => `/og/${name}.jpg`;

/** Next.js metadata for a page: title, description, canonical, robots and share tags. */
export function metadataFor(path: string): Metadata {
  const p = pageSeo(path);
  const images = [{ url: ogImage(p.image), width: 1200, height: 630, alt: p.imageAlt, type: "image/jpeg" }];
  return {
    title: { absolute: p.title },
    description: p.description,
    alternates: { canonical: p.path },
    robots: p.index ? { index: true, follow: true, "max-image-preview": "large" } : { index: false, follow: p.path !== "/thank-you" },
    openGraph: { type: "website", siteName: site.name, locale: site.locale, url: p.path, title: p.title, description: p.description, images },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images }
  };
}

/** schema.org data for a page, as one JSON-LD graph. Without a page: just the organization and site. */
export function structuredData(page?: PageSeo) {
  const org = `${SITE_URL}/#organization`, website = `${SITE_URL}/#website`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization", "@id": org, name: site.name, url: `${SITE_URL}/`, description: site.description,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
      areaServed: { "@type": "Country", name: site.country },
      ...(site.email && { email: site.email }), ...(site.sameAs.length > 0 && { sameAs: site.sameAs })
    },
    { "@type": "WebSite", "@id": website, url: `${SITE_URL}/`, name: site.name, description: site.description, publisher: { "@id": org }, inLanguage: site.lang }
  ];
  if (!page) return { "@context": "https://schema.org", "@graph": graph };

  const url = SITE_URL + (page.path === "/" ? "/" : page.path);
  const image = SITE_URL + ogImage(page.image);
  graph.push({
    "@type": page.kind, "@id": `${url}#webpage`, url, name: page.title, description: page.description,
    isPartOf: { "@id": website }, about: { "@id": org }, inLanguage: site.lang,
    primaryImageOfPage: { "@type": "ImageObject", url: image, width: 1200, height: 630 },
    ...(page.crumbs.length > 0 && { breadcrumb: { "@id": `${url}#breadcrumb` } })
  });
  if (page.crumbs.length > 0) {
    const items: Crumb[] = [["GROWND", "/"], ...page.crumbs];
    graph.push({
      "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
      itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, ...(i < items.length - 1 && path && { item: SITE_URL + path }) }))
    });
  }
  if (page.service) {
    const [min, max] = page.service.ages.split("-").map(Number);
    graph.push({
      "@type": "Service", "@id": `${url}#service`, name: page.service.name, serviceType: page.service.serviceType,
      description: page.service.description, url, image, provider: { "@id": org },
      areaServed: { "@type": "Country", name: site.country },
      audience: { "@type": "PeopleAudience", suggestedMinAge: min, suggestedMaxAge: max }
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

