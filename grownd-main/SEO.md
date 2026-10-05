# SEO for GROWND

What is set up, how to keep it right, and how to grow it. The words that appear in search results live in [frontend/seo.mjs](frontend/seo.mjs). `npm run build` turns them into the site, and `npm run check:site` checks the result.

## What is in place

| Item | What the site does now | Where |
| --- | --- | --- |
| Clean URLs | Every page has a real address: `/missions/slime-chemistry`, `/quiz/chemist`, `/about`. Old `#/` links redirect to the clean address. `.html` endings and trailing slashes redirect too. | `vercel.json` (`cleanUrls`), router in the design source |
| Meta titles | Unique per page, under 60 characters, with the keyword first. Example: *Slime Chemistry Science Birthday Party, Ages 5-8 \| GROWND*. | `frontend/seo.mjs` |
| Meta descriptions | Unique per page, under 160 characters. | `frontend/seo.mjs` |
| One h1 per page | Each page has exactly one h1. The quiz now has a descriptive h1, and its questions are h2. | design source, checked by `check:site` |
| Heading order | No skipped levels: h1, then h2, then h3. Fixed on the home, missions, mission, quiz and result pages. | design source |
| Canonical tags | Every indexable page points at its own `https://` address. The missions filter (`/missions?cat=…`) points at `/missions`, so filters don't create duplicate pages. | build |
| Share image (og:image) | A 1200×630 image for every page: one for the brand, one for the quiz, one per mission and one per scientist type. Each is 58-77 KB, well under WhatsApp's 300 KB limit, and has alt text. | `frontend/assets/og/`, made by `frontend/tools/make-images.mjs` |
| Schema markup | Every page carries JSON-LD for the Organization, WebSite and WebPage. Inner pages add a BreadcrumbList, mission pages add a Service with age range, and dated events add an Event with price and availability once the dashboard has dates. | `frontend/seo.mjs`, `ldEvents()` in the design source |
| sitemap.xml | Lists the 14 pages worth finding in search. Pages kept out of search are not listed. | build writes `/sitemap.xml` |
| robots.txt | Lets everything be crawled except `/admin` and `/api/`, and points at the sitemap. | build writes `/robots.txt` |
| noindex | Register, thank-you, The Lab (thin until it has content), checkout, admin, the 404 page and the API stay out of search, via meta tags and `X-Robots-Tag` headers. | `frontend/seo.mjs`, `vercel.json` |
| Enforce HTTPS | Vercel redirects `http://` to `https://`. HSTS tells browsers to only ever use HTTPS. Every canonical and share link is `https://`. | `vercel.json` |
| Internal links | All links are real `<a href>` links that crawlers can follow. Every page lists the missions, and mission pages link to related missions and their scientist type. | design source, build |
| Crawlers without JavaScript | Each page also contains a plain-HTML version of its content and links. Browsers remove it once the live page starts. This covers Bing's first pass, AI search crawlers and link previews. | build |
| Broken links | None. `npm run check:site` checks every internal link on every page. | `frontend/tools/check-site.mjs` |
| Alt text | The site has no photos yet, only placeholders. The drawings have descriptions, icons are hidden from screen readers, the placeholders say what photo goes there, and share images have alt text. See [Adding photos](#adding-photos). | design source |
| Compressed images | Share images are JPEG at about 70 KB each, and icons are small PNGs. Fonts are WOFF2. Vercel compresses HTML, CSS and JS with Brotli. | |
| Mobile | Tested at 375 px wide: nothing wider than the screen on any page, and every page has one h1. The ticket card is now laid out properly on phones, and small links are now at least 40-44 px tall so they're easy to tap. | design source |
| Core Web Vitals | See below. | |

### Core Web Vitals

The old page was one 500 KB self-unpacking file that loaded React from unpkg.com and fonts from Google. Now pages load React, the page runtime and fonts from GROWND's own domain. Those files have content hashes in their names, so browsers keep them for a year. The runtime is minified, and the three main fonts are preloaded.

Lighthouse, mobile, compressed as Vercel serves it, home page:

| | Before | After |
| --- | --- | --- |
| Performance | 86 | **92** |
| SEO | 82 | **100** |
| Accessibility | 91 | **100** |
| Best practices | 100 | **100** |
| First Contentful Paint | 1.8 s | **0.85 s** |
| Largest Contentful Paint | 2.7 s (needs improvement) | **2.3 s (good)** |
| Layout shift (CLS) | 0.006 | **0** |
| Data downloaded | 251 KB | **170 KB** |

Real visitors' numbers appear in Search Console under **Core Web Vitals** about four weeks after launch.

## Before you ask Google to index the site

Search results show what is on the page, so replace the placeholders first:

- In the dashboard: prices, currency (`INR`), dates, reply time and the safety note. These fill `[PRICE]`, `[DATE]`, `[CITY …]`, `[RESPONSE TIME]` and `[INSURANCE AND DBS DETAILS]`.
- In the design source: `MISSION CONTROL / [CITY]`, the team names (`[TEAM LEAD]`, `[TECH LEAD]`, `[CONTENT LEAD]`) and the photos (`[PHOTO …]`, `[VIDEO …]`).
- The mission notes mention **DBS checks**, which are a UK thing. For India, say what you actually do, for example police verification and child-safety training.
- The footer says card payments are handled by Stripe. That changes once Razorpay is in.
- In `frontend/seo.mjs`, fill `site.email` and `site.sameAs` (your Instagram, YouTube and Facebook pages) once they exist.

## Google Search Console

1. Go to <https://search.google.com/search-console> and click **Add property**.
2. Choose **URL prefix** and enter `https://grownd-beige.vercel.app`. With your own domain, choose **Domain** instead and add the TXT record it gives you at your domain registrar. That covers every subdomain, and you can skip steps 3-5.
3. Under **HTML tag**, copy only the `content` value, which looks like `abc123…`.
4. In Vercel, add an environment variable `GOOGLE_SITE_VERIFICATION` with that value, then redeploy. Every page now carries the tag. The value isn't secret, so you can also send it to me and I'll add it.
5. Back in Search Console, click **Verify**.
6. Open **Sitemaps** and submit `sitemap.xml`.
7. Optional: in [Bing Webmaster Tools](https://www.bing.com/webmasters), choose **Import from Google Search Console**. That covers Bing, DuckDuckGo and ChatGPT search, which uses Bing's index.

Then check **Pages** after a week: the 14 sitemap pages should move to *Indexed*.

## Your own domain

When you add a domain in Vercel (for example `grownd.in`) and make it the production domain, the next deploy uses it for canonical links, the sitemap, robots.txt and share images automatically. To force a specific address, set `SITE_URL` in Vercel. The API uses the same variable for payment return links.

## Adding photos

Real photos help a lot, both in image search and for trust. When you add them:

- **Alt text** says what is in the photo, in plain words, including the mission. For example: *"Two children stretching green slime at a Slime Chemistry birthday party"*. Avoid "image of…" and keyword lists. Each slot already names what it expects, for example `Photo to come: children mid-experiment in Slime Chemistry`.
- **Size and format:** export at 1600 px wide at most, as WebP or AVIF at quality 75-80, which lands around 100-250 KB. Always set `width` and `height` on the `<img>` so the page doesn't jump while it loads.
- **Loading:** use `loading="lazy"` for photos below the first screen, and `fetchpriority="high"` for the one main photo at the top of a page.
- **File names:** use words, like `slime-chemistry-birthday-party.webp`, not `IMG_2041.jpg`.
- Only use photos of children with written consent from their parents.

## Changing things

- **Words in search results:** edit `frontend/seo.mjs`, then run `npm run build` and `npm run check:site`.
- **A mission's title, line or colour:** edit the design source, then redraw the share images with `npm install --no-save puppeteer-core`, then `node frontend/tools/make-images.mjs`.
- **A new page in the app:** add it to the router (`path()` and `parsePath()` in the design source) and to `pages()` in `frontend/seo.mjs`.

## Backlink strategy

Links from other trustworthy sites are the strongest signal you can't set in code. For a local children's business, a few relevant local links beat many random ones. Aim for 5-10 good links a month, and track them in Search Console under **Links**.

### Month 1: get listed where parents look

1. **Google Business Profile.** This matters most for "science party near me" searches and Google Maps. Add the category (e.g. *Children's party service*, *Educational institution*), service areas, photos, the site link and booking link. Ask every happy parent for a review.
2. **Bing Places** and **Apple Business Connect**, with the same details.
3. Keep the business name, phone and city written exactly the same everywhere. Search engines match them across sites.
4. **Indian local directories:** Justdial, Sulekha and UrbanPro (for workshops and coding classes).
5. **Kids' event and city guides:** LBB (Little Black Book) for your city, KidsStopPress (Mumbai), allevents.in, and BookMyShow's workshops and kids section for public dated sessions.

### Months 2-3: earn links through the people you already work with

6. **Schools.** After a Crime Scene Biology visit, ask the school to mention it in its newsletter or "events" page with a link. Offer a short write-up and photos (with consent).
7. **Venues and partners:** party venues, play cafés, bookshops, toy and STEM-kit shops, maker spaces and apartment communities. Offer to be their "science party partner" and list them on a partners page on your site.
8. **Parenting communities and blogs:** Parentune, Mompresso, theAsianparent India and city parenting groups. Write genuinely useful guest posts, such as "How to plan a science birthday party at home" or "5 kitchen experiments for a rainy Saturday", with one link back.

### Ongoing: create things worth linking to

9. **The scientist quiz** is shareable already. Every result has its own page and share image. Encourage parents to share their child's result.
10. **The Lab:** when it opens, publish free printable experiments and safety guides (making slime safely, a dry-ice safety checklist, a science-fair project picker). Schools and blogs link to free resources. Remove The Lab's noindex then.
11. **Local press:** pitch city supplements of national newspapers and local news sites with a story, like a school forensic day or a free workshop at a library.
12. **Instagram and YouTube:** short reels of reactions. Their links don't pass ranking value, but they bring parents who then link and search for you by name.

### City pages, later

When you run missions regularly in a city, add a real page for it, like "Science birthday parties in Bengaluru". It should have that city's venues, dates, photos and reviews. Don't make near-identical pages for many cities: Google treats them as doorway pages.

### Avoid

Avoid buying links, link farms, mass directory submissions, mass link swaps and comment spam. They break Google's spam policies and can get the whole site ranked down.
