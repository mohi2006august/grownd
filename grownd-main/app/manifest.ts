import type { MetadataRoute } from "next";
import { site } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name, short_name: site.name, description: site.description, lang: site.lang, start_url: "/", display: "browser",
    background_color: site.themeColor, theme_color: site.themeColor,
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }]
  };
}
