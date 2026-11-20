import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultState } from "@/lib/defaults";
import { HttpError } from "@/lib/auth";
import { GET } from "@/app/api/admin/preview/route";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  state: vi.fn(),
  schedule: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requireAdmin: mocks.admin,
}));
vi.mock("@/lib/store", () => ({
  readState: mocks.state,
  ConflictError: class extends Error {},
}));
vi.mock("@/lib/main-system-client", () => ({ fetchSchedule: mocks.schedule }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue(undefined);
  mocks.schedule.mockResolvedValue({ date: "2026-11-20", lessons: [] });
  const state = defaultState();
  state.draft.schoolName = "草稿中的教室";
  state.published = {
    version: 7,
    publishedAt: "2026-11-20T00:00:00Z",
    content: { ...state.draft, schoolName: "正式發布教室" },
  };
  mocks.state.mockResolvedValue(state);
});
const request = (query = "") =>
  new Request(`http://localhost/api/admin/preview${query}`);

describe("admin preview content source", () => {
  it("defaults to the saved draft", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.content.schoolName).toBe(
      "草稿中的教室",
    );
  });
  it("reads the published snapshot without pairing or changing content", async () => {
    const response = await GET(request("?source=published"));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      version: 7,
      content: { schoolName: "正式發布教室" },
    });
  });
  it("does not substitute a draft when there is no publication", async () => {
    mocks.state.mockResolvedValue(defaultState());
    const response = await GET(request("?source=published"));
    expect(response.status).toBe(404);
    expect((await response.json()).data).toBeNull();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it("rejects unknown sources", async () => {
    expect((await GET(request("?source=invalid"))).status).toBe(400);
    expect(mocks.state).not.toHaveBeenCalled();
  });
  it("requires an admin for both sources", async () => {
    mocks.admin.mockRejectedValue(new HttpError(401, "請先登入管理後台"));
    for (const query of ["?source=draft", "?source=published"])
      expect((await GET(request(query))).status).toBe(401);
    expect(mocks.state).not.toHaveBeenCalled();
  });
});
