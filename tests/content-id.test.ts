import { describe, expect, it, vi } from "vitest";
import { createContentId } from "@/lib/content-id";

describe("createContentId", () => {
  it("creates distinct UUIDs when randomUUID is unavailable", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    try {
      const ids = new Set(Array.from({ length: 100 }, () => createContentId()));
      expect(ids.size).toBe(100);
      for (const id of ids) {
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
