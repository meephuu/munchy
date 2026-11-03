import { BACKEND_URL } from "@/lib/backend";

// GET /api/foods?q=... : food suggestions for the "add an ingredient" search. A thin proxy to the
// backend's /foods/search so the browser never needs the backend's address.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return Response.json([]);

  try {
    const res = await fetch(`${BACKEND_URL}/foods/search?q=${encodeURIComponent(q)}&limit=8`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return Response.json({ error: "Search failed" }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Search is unavailable" }, { status: 502 });
  }
}
