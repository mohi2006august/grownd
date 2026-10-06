import type { CSSProperties } from "react";

/** Inline styles that use CSS custom properties (var(--lay-...) for screen-size layout, or --x values). */
export const css = (style: Record<string, string | number | undefined>) => style as CSSProperties;
