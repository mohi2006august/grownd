// /readyz, answered by the API's own health check.
import { forward } from "@/lib/api-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => forward(req, "/readyz");
