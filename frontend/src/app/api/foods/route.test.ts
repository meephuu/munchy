import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const call = (q?: string) => GET(new Request(`http://localhost/api/foods${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`));

describe("GET /api/foods", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards the query to the backend and returns its suggestions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 1, name: "egg" }]))));
    const res = await call("  egg ");
    expect(await res.json()).toEqual([{ id: 1, name: "egg" }]);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/\/foods\/search\?q=egg&limit=8$/);
  });

  it("answers short or missing queries with an empty list without calling the backend", async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const q of [undefined, "", "e", "  "]) expect(await (await call(q)).json()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("turns a backend error or an unreachable backend into a 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    expect((await call("egg")).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect((await call("egg")).status).toBe(502);
  });
});
