import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseConfig } from "./env";

describe("supabaseConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  const set = (url: string, publishable: string, anon: string) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishable);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
  };

  it("reads the URL and the publishable key (the name Supabase's dashboard uses)", () => {
    set("https://x.supabase.co", "sb_publishable_abc", "");
    expect(supabaseConfig()).toEqual({
      url: "https://x.supabase.co",
      key: "sb_publishable_abc",
    });
  });

  it("still accepts the older anon key name", () => {
    set("https://x.supabase.co", "", "anon-key");
    expect(supabaseConfig()).toEqual({
      url: "https://x.supabase.co",
      key: "anon-key",
    });
  });

  it("prefers the publishable key when both are set", () => {
    set("https://x.supabase.co", "sb_publishable_abc", "anon-key");
    expect(supabaseConfig()?.key).toBe("sb_publishable_abc");
  });

  it("is off when the URL or the key is missing", () => {
    set("", "sb_publishable_abc", "");
    expect(supabaseConfig()).toBeNull();
    set("https://x.supabase.co", "", "");
    expect(supabaseConfig()).toBeNull();
  });
});
