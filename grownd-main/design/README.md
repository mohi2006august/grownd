# Design files (reference only)

The original design-tool files the website was converted from: `GROWND Website v2.dc.html` holds every page, `MissionCard.dc.html`, `SiteHeader.dc.html` and `SiteFooter.dc.html` the shared parts, and `support.js` the runtime that renders them.

The live site no longer builds from these files. To change the site, edit the Next.js code instead: words and missions in `lib/missions.ts`, search titles in `lib/seo.ts`, and layout in `app/(site)/` and `components/` (see the main [README](../README.md#the-website)).

To look at them, serve the folder (`npx serve design`) rather than double-clicking a file, because they load their neighbours.
