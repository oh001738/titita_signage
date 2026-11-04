import mongoose, { Schema } from "mongoose";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaultState } from "./defaults";
import type { CmsState } from "@/types";
export const dataDir = () =>
  path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || "./data");
const stateSchema = new Schema(
  {
    _id: String,
    revision: Number,
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
if (process.env.NODE_ENV === "development") delete mongoose.models.SignageState;
const State =
  mongoose.models.SignageState || mongoose.model("SignageState", stateSchema);
const globalStore = globalThis as typeof globalThis & {
  signageQueue?: Promise<unknown>;
  signageDb?: Promise<typeof mongoose>;
};
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("請設定獨立 CMS 的 MONGODB_URI");
  globalStore.signageDb ??= mongoose.connect(uri).catch((error) => {
    globalStore.signageDb = undefined;
    throw error;
  });
  await globalStore.signageDb;
}
export async function readState(): Promise<CmsState> {
  if (process.env.CMS_STORAGE === "file") {
    if (process.env.MOCK_MODE !== "true")
      throw new Error("檔案儲存僅供模擬模式；正式環境請使用 MongoDB");
    try {
      return JSON.parse(
        await readFile(path.join(dataDir(), "cms.json"), "utf8"),
      ) as CmsState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return defaultState();
      throw error;
    }
  }
  await connectDB();
  const doc = await State.findById("cms").lean();
  return doc ? (structuredClone(doc.value) as CmsState) : defaultState();
}
export async function atomicWrite(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, file);
}
export class ConflictError extends Error {}
export async function mutateState<T>(
  update: (state: CmsState) => T | Promise<T>,
): Promise<T> {
  const task = (globalStore.signageQueue ?? Promise.resolve()).then(
    async () => {
      const state = await readState();
      const revision = state.revision;
      const result = await update(state);
      state.revision++;
      if (process.env.CMS_STORAGE === "file")
        await atomicWrite(path.join(dataDir(), "cms.json"), state);
      else {
        await connectDB();
        if (revision === 0) {
          try {
            await State.create({
              _id: "cms",
              revision: state.revision,
              value: state,
            });
          } catch (error) {
            if ((error as { code?: number }).code === 11000)
              throw new ConflictError("資料已更新，請重新載入");
            throw error;
          }
        } else {
          const result = await State.updateOne(
            { _id: "cms", revision },
            { $set: { revision: state.revision, value: state } },
          );
          if (!result.matchedCount)
            throw new ConflictError("資料已更新，請重新載入");
        }
      }
      return result;
    },
  );
  globalStore.signageQueue = task.catch(() => undefined);
  return task;
}
