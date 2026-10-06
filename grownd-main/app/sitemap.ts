import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.filter(p => p.index).map(p => ({ url: SITE_URL + (p.path === "/" ? "/" : p.path) }));
}
