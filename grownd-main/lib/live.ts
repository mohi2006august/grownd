// Live content the team manages in the dashboard: prices, dates, site details and whether online
// payment is on. Read on the server straight from the backend's content service (the same data
// /api/content serves), so pages are built with real prices and dates in their HTML.

export interface LiveEvent {
  id: number;
  date: string | null;
  time: string | null;
  timezone: string | null;
  venue: string | null;
  city: string | null;
  placesLeft: number;
}

export interface LiveMission {
  title: string;
  type: string;
  unit: "child" | "class";
  price: number | null;
  events: LiveEvent[];
}

export interface Live {
  settings: { currency: string; timezone: string; responseTime: string; insuranceNote: string };
  payments: { enabled: boolean; holdMinutes: number };
  missions: Record<string, LiveMission>;
}

/** Live content, or null when the database is not set up or not reachable (pages then show their defaults). */
export async function getLive(): Promise<Live | null> {
  try {
    const { getContentJson } = await import("@/backend/src/services/content.js");
    return JSON.parse(await getContentJson()) as Live;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn(`[grownd] live content unavailable: ${(err as Error).message}`);
    return null;
  }
}

