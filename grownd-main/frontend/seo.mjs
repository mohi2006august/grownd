// Search and sharing copy for every page of the public site: titles, descriptions, share images,
// structured data, and a plain-HTML version of each page for crawlers that do not run JavaScript.
// Edit the words here; `npm run build` (frontend/build.mjs) turns them into dist/.

export const site = {
  name: 'GROWND',
  lang: 'en-IN',
  locale: 'en_IN',
  country: 'India',
  countryCode: 'IN',
  themeColor: '#0A0E1A',
  description: 'Hands-on science parties, workshops, school events and coding sessions for children aged 5 to 12. We bring the kit, the scientists and the clean-up.',
  // Fill these in once they exist. Search engines use them to connect GROWND's profiles.
  email: '',
  sameAs: [] // for example 'https://www.instagram.com/grownd'
};

const INDEX = 'index, follow, max-image-preview:large';
const NOINDEX = 'noindex, follow';

// Search titles stay under about 60 characters and descriptions under about 160, or Google cuts them off.
const MISSION_COPY = {
  'slime-chemistry': {
    title: 'Slime Chemistry Science Birthday Party, Ages 5-8',
    description: 'A 90-minute slime chemistry party for ages 5-8. Kids mix polymers, test their slime and take home a pot and recipe card. We bring everything.'
  },
  'rocket-engineering': {
    title: 'Rocket Engineering Workshop for Kids, Ages 7-11',
    description: 'Two hours of rocket design for ages 7-11: build a rocket, launch it on a pressure launcher, then improve it. All kit and two scientists included.'
  },
  'crime-scene-biology': {
    title: 'Crime Scene Biology: Forensic Science for Schools',
    description: 'Forensic science for a whole class, ages 8-12. Pupils lift fingerprints, compare fibres and solve a staged crime together. Up to 32 per session.'
  },
  'light-and-lasers': {
    title: 'Light and Lasers Science Workshop, Ages 7-12',
    description: 'A 90-minute light workshop for ages 7-12: split white light, bend a laser through water and race a mirror maze. Safe, fully supervised lasers.'
  },
  'build-a-game-in-scratch': {
    title: 'Build a Game in Scratch: Coding for Kids 8-12',
    description: 'Kids aged 8-12 build a playable Scratch game in two hours, with a score, a timer and sound. No coding experience needed. Everyone leaves with a link.'
  },
  'glow-lab': {
    title: 'Glow Lab: Dry Ice and UV Science Party, Ages 5-10',
    description: 'Our seasonal science party for ages 5-10: dry ice fog, UV paint and colour-change reactions in a dark room. Every child takes home a glow badge.'
  }
};

const SERVICE_TYPE = {
  Birthday: 'Children\'s science birthday party',
  'Private celebration': 'Private children\'s science party',
  Workshop: 'Children\'s science workshop',
  'School event': 'School science workshop',
  Coding: 'Children\'s coding workshop',
  'Seasonal event': 'Children\'s seasonal science event'
};

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const isPlaceholder = s => /^\[[^\]]+\]$/.test(String(s).trim());

/** Shortens text to whole sentences (or words) within `max` characters. */
export function clip(text, max = 158) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const sentence = cut.lastIndexOf('. ');
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}

const list = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const missionLink = m => `<a href="/missions/${m.slug}">${esc(m.title)}</a>: ${esc(m.line)}`;

/** Every public page: its address, search copy, share image, breadcrumbs and plain-HTML content. */
export function pages({ missions, types, order }) {
  const typeOf = m => types[m.type];
  const out = [];

  out.push({
    path: '/', title: 'GROWND | Science Parties and STEM Workshops for Kids 5-12',
    description: 'Hands-on science for ages 5-12: birthday parties, workshops, school events and coding. We bring the kit, the scientists and the clean-up.',
    robots: INDEX, image: 'default', imageAlt: 'GROWND: every child is a scientist. Some just need a lab.', kind: 'WebPage', crumbs: [], sitemap: true,
    content: `<h1>Every child is a scientist. Some just need a lab.</h1>
<p>Hands-on STEM missions for ages 5 to 12: birthdays, workshops, school events and coding sessions. We bring the kit, the scientists and the clean-up. You bring the children.</p>
<p><a href="/register">Book a science experience</a> or <a href="/missions">see all six missions</a>.</p>
<h2>Choose your mission</h2>${list(missions.map(missionLink))}
<h2>What kind of scientist are you?</h2>
<p>Six questions, no wrong answers, four possible scientist types. Each one points at the missions that suit it. <a href="/quiz">Start the quiz</a>.</p>`
  });

  out.push({
    path: '/missions', title: 'Science Missions for Kids Aged 5-12 | GROWND',
    description: 'Six hands-on missions: slime chemistry, rockets, forensic biology, lasers, Scratch coding and a glow lab. Find the right one for your child.',
    robots: INDEX, image: 'default', imageAlt: 'GROWND science missions for children aged 5 to 12', kind: 'CollectionPage', crumbs: [['Missions']], sitemap: true,
    content: `<h1>Six missions. Pick the one that sounds like your kid.</h1>
<p>Not sure? <a href="/quiz">Take the two-minute scientist quiz</a> and we will point you at the right one.</p>
<h2>The missions</h2>${list(missions.map(m => `${missionLink(m)} (${esc(m.cat)}, ages ${esc(m.ages)}, ${m.mins} minutes)`))}`
  });

  for (const m of missions) {
    const t = typeOf(m), copy = MISSION_COPY[m.slug] || { title: `${m.title}: ${SERVICE_TYPE[m.cat] || 'Science mission'}, Ages ${m.ages}`, description: clip(`${m.line} ${m.para}`) };
    const others = missions.filter(x => x.slug !== m.slug).sort((a, b) => (b.type === m.type) - (a.type === m.type)).slice(0, 3);
    const worth = m.worth.filter(w => !isPlaceholder(w));
    out.push({
      path: `/missions/${m.slug}`, title: `${copy.title} | GROWND`, description: copy.description,
      robots: INDEX, image: m.slug, imageAlt: `${m.title} by GROWND: ${m.cat.toLowerCase()} for ages ${m.ages}`, kind: 'WebPage',
      crumbs: [['Missions', '/missions'], [m.title]], sitemap: true,
      service: { name: m.title, serviceType: SERVICE_TYPE[m.cat] || 'Children\'s science workshop', description: m.para, ages: m.ages },
      content: `<h1>${esc(m.title)}</h1>
<p>${esc(m.para)}</p>
${list([`Ages ${esc(m.ages)}`, `${m.mins} minutes`, `Up to ${m.cap} children`, esc(m.cat), `For ${t.an} ${esc(t.name.toLowerCase())}: <a href="/quiz/${t.slug}">what that means</a>`])}
<h2>What they actually do</h2><ol>${m.steps.map(([h, p]) => `<li><strong>${esc(h)}</strong> ${esc(p)}</li>`).join('')}</ol>
<h2>What is included</h2>${list(m.incl.map(esc))}
${worth.length ? `<h2>Worth knowing</h2>${list(worth.map(esc))}` : ''}
<p><a href="/register/${m.slug}">Register interest in ${esc(m.title)}</a></p>
<h2>Other missions worth a look</h2>${list(others.map(missionLink))}`
    });
  }

  out.push({
    path: '/quiz', title: 'What Kind of Scientist Is Your Child? Free Quiz | GROWND',
    description: 'Six questions, two minutes, four scientist types. Find out if your child is a biologist, chemist, physicist or engineer, and which mission suits them.',
    robots: INDEX, image: 'quiz', imageAlt: 'The GROWND scientist quiz: what kind of scientist is your child?', kind: 'WebPage', crumbs: [['Scientist quiz']], sitemap: true,
    content: `<h1>Scientist quiz: what kind of scientist is your child?</h1>
<p>Six questions, two minutes, four scientist types. Nothing is stored. The quiz needs JavaScript; here are the four types it can find:</p>
${list(order.map(k => `<a href="/quiz/${types[k].slug}">${esc(types[k].name)}</a>: ${esc(types[k].tag)}`))}`
  });

  for (const k of order) {
    const t = types[k], recs = t.recs.map(id => missions.find(m => m.id === id)).filter(Boolean);
    out.push({
      path: `/quiz/${t.slug}`, title: `Is Your Child ${t.an === 'an' ? 'an' : 'a'} ${t.name}? Science Missions to Match | GROWND`,
      description: clip(t.desc), robots: INDEX, image: t.slug, imageAlt: `GROWND scientist type: ${t.name}. ${t.tag}`, kind: 'WebPage',
      crumbs: [['Scientist quiz', '/quiz'], [t.name]], sitemap: true,
      content: `<h1>You are ${t.an} ${esc(t.name)}</h1>
<p><strong>${esc(t.tag)}</strong></p>
<p>${esc(t.desc)}</p>
${list(t.traits.map(esc))}
<h2>Missions for ${esc(t.name.toLowerCase())}s</h2>${list(recs.map(missionLink))}
<p><a href="/quiz">Take the quiz</a></p>`
    });
  }

  out.push({
    path: '/about', title: 'Who We Are | GROWND Science Experiences for Kids',
    description: 'GROWND is a small team running hands-on STEM missions for children aged 5-12. The person who plans your mission is the person who turns up to run it.',
    robots: INDEX, image: 'default', imageAlt: 'The GROWND team', kind: 'AboutPage', crumbs: [['Who we are']], sitemap: true,
    content: `<h1>Three scientists who think the cake should come second.</h1>
<p>GROWND is a small team. The person who plans your mission is the person who turns up to run it.</p>
${list(['<strong>Science and experience:</strong> plans every mission and runs most of them.', '<strong>Technology:</strong> builds the coding missions and this website.', '<strong>Content:</strong> films the reactions, writes the recipe cards and runs the Instagram challenges.'])}`
  });

  // Thin or private pages: reachable, but kept out of search results.
  out.push({
    path: '/lab', title: 'The Lab: Experiments for Young Scientists | GROWND',
    description: 'Experiments of the week, home challenges and achievement badges for young scientists. Opening after the first GROWND missions run.',
    robots: NOINDEX, image: 'default', imageAlt: 'The GROWND Lab', kind: 'WebPage', crumbs: [['The Lab']],
    content: `<h1>The Lab is still bubbling.</h1>
<p>Experiments of the week, home challenges and achievement badges land here after the first missions run. For now, the best experiment on the site is the <a href="/quiz">quiz</a>.</p>`
  });
  out.push(registerPage(null));
  for (const m of missions) out.push(registerPage(m));
  out.push({
    path: '/thank-you', title: 'Thanks, We Have Your Details | GROWND',
    description: 'Your details are with the GROWND team. A real person replies with dates, a price and a couple of questions about the room.',
    robots: 'noindex, nofollow', image: 'default', imageAlt: 'GROWND', kind: 'WebPage', crumbs: [['Details received']],
    content: `<h1>Thanks. A real person takes it from here.</h1><p><a href="/missions">Browse more missions</a></p>`
  });
  return out;
}

function registerPage(m) {
  return {
    path: m ? `/register/${m.slug}` : '/register',
    title: m ? `Register Interest: ${m.title} | GROWND` : 'Register Interest | GROWND',
    description: 'Tell us who is coming and a real person replies with dates, a price and the logistics. No payment at this stage.',
    robots: NOINDEX, image: m ? m.slug : 'default', imageAlt: m ? `${m.title} by GROWND` : 'GROWND', kind: 'WebPage',
    crumbs: m ? [['Missions', '/missions'], [m.title, `/missions/${m.slug}`], ['Register interest']] : [['Register interest']],
    content: `<h1>Tell us who is coming</h1>
<p>No payment here. Send us the details and a real person replies with dates, a price and the boring logistics. The form needs JavaScript switched on.</p>`
  };
}

export const notFoundPage = {
  path: null, title: 'Page Not Found | GROWND',
  description: 'The page you wanted is not here. Browse GROWND\'s science missions for children aged 5 to 12 instead.',
  robots: 'noindex, nofollow', image: 'default', imageAlt: 'GROWND', kind: 'WebPage', crumbs: [],
  content: `<h1>This one did not react.</h1><p>The page you wanted is not here. <a href="/">Back to the lab</a> or <a href="/missions">browse all missions</a>.</p>`
};

/** schema.org data for a page, as one JSON-LD graph. */
export function structuredData(page, { origin, imageUrl, logoUrl }) {
  const org = `${origin}/#organization`, website = `${origin}/#website`, url = origin + (page.path || '/');
  const graph = [
    {
      '@type': 'Organization', '@id': org, name: site.name, url: `${origin}/`, description: site.description,
      logo: { '@type': 'ImageObject', url: logoUrl, width: 512, height: 512 },
      areaServed: { '@type': 'Country', name: site.country },
      ...(site.email && { email: site.email }), ...(site.sameAs.length && { sameAs: site.sameAs })
    },
    { '@type': 'WebSite', '@id': website, url: `${origin}/`, name: site.name, description: site.description, publisher: { '@id': org }, inLanguage: site.lang }
  ];
  if (!page.path) return { '@context': 'https://schema.org', '@graph': graph };

  graph.push({
    '@type': page.kind, '@id': `${url}#webpage`, url, name: page.title, description: page.description,
    isPartOf: { '@id': website }, about: { '@id': org }, inLanguage: site.lang,
    primaryImageOfPage: { '@type': 'ImageObject', url: imageUrl, width: 1200, height: 630 },
    ...(page.crumbs.length && { breadcrumb: { '@id': `${url}#breadcrumb` } })
  });
  if (page.crumbs.length) {
    const items = [['GROWND', '/'], ...page.crumbs];
    graph.push({
      '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
      itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(i < items.length - 1 && { item: origin + path }) }))
    });
  }
  if (page.service) {
    const [min, max] = page.service.ages.split('-').map(Number);
    graph.push({
      '@type': 'Service', '@id': `${url}#service`, name: page.service.name, serviceType: page.service.serviceType,
      description: page.service.description, url, image: imageUrl, provider: { '@id': org },
      areaServed: { '@type': 'Country', name: site.country },
      audience: { '@type': 'PeopleAudience', suggestedMinAge: min, suggestedMaxAge: max }
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
