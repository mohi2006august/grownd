import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL, site } from "@/lib/seo";
import "./globals.css";
import "./hover.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: site.name,
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png"
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION && { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } })
};

export const viewport: Viewport = { themeColor: site.themeColor, colorScheme: "dark light" };

// Runs before the first paint: old "#/mission/slime-chemistry" links go to their clean address, then
// the saved light/dark choice, and hiding reveal-on-scroll sections until the page's script takes over
// (shown again after 6s if it never does).
const BOOT = `(function(d){var h=location.hash;if(h.indexOf('#/')===0){var q=h.slice(1).split('?'),s=q[0].split('/'),o={mission:'missions',result:'quiz',sent:'thank-you',who:'about'};if(o[s[1]])s[1]=o[s[1]];location.replace(s.join('/')+(q[1]?'?'+q[1]:''));return}d.classList.add('gr-js');try{if(localStorage.getItem('grownd-theme')==='light')d.classList.add('gr-light')}catch(e){}setTimeout(function(){if(!window.__grReady)d.classList.remove('gr-js')},6000)})(document.documentElement)`;

const FONTS = ["figtree-latin", "space-grotesk-latin", "jetbrains-mono-latin"];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={site.lang} suppressHydrationWarning>
      <head>
        {FONTS.map(f => <link key={f} rel="preload" href={`/fonts/${f}.woff2`} as="font" type="font/woff2" crossOrigin="" />)}
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
