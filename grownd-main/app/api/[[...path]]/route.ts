// Every /api/* request goes to the GROWND API (backend/src).
import { forward } from "@/lib/api-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handle = (req: Request) => forward(req);
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS, handle as HEAD };
