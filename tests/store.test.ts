import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { mutateState, readState } from "../lib/store";
let dir = "";
afterEach(async () => {
  vi.unstubAllEnvs();
  if (dir) await rm(dir, { recursive: true, force: true });
});
it("serializes concurrent file writes and keeps content versions separate from device heartbeats", async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "signage-store-"));
  vi.stubEnv("CMS_STORAGE", "file");
  vi.stubEnv("MOCK_MODE", "true");
  vi.stubEnv("DATA_DIR", dir);
  await Promise.all(
    Array.from({ length: 12 }, () =>
      mutateState((s) => {
        s.draft.footer += "!";
      }),
    ),
  );
  let state = await readState();
  expect(state.revision).toBe(12);
  expect(state.contentRevision).toBe(0);
  expect(state.draft.footer.endsWith("!".repeat(12))).toBe(true);
  await mutateState((s) => {
    s.contentRevision++;
  });
  state = await readState();
  expect(state.contentRevision).toBe(1);
});
