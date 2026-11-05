import { describe, expect, it } from "vitest";
import { defaultContent } from "@/lib/defaults";
import { contentSchema } from "@/lib/validation";

describe("logo content", () => {
  it("keeps old drafts compatible and uses text branding when unset", () => {
    const content = defaultContent();
    delete content.logo;
    expect(contentSchema.parse(content).logo).toBe("");
  });
  it("accepts the trial and uploaded image paths and rejects external paths", () => {
    for (const logo of [
      "",
      "/school-logo-trial.png",
      "/api/media/aabbccdd-1234.png",
    ]) {
      expect(
        contentSchema.safeParse({ ...defaultContent(), logo }).success,
      ).toBe(true);
    }
    for (const logo of [
      "https://example.com/logo.png",
      "/api/media/../../private.png",
    ]) {
      expect(
        contentSchema.safeParse({ ...defaultContent(), logo }).success,
      ).toBe(false);
    }
  });
});
