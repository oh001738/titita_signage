import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
const dateTime = z.union([z.literal(""), z.iso.datetime({ offset: true })]);
const windowFields = { startsAt: dateTime, endsAt: dateTime };
const validWindow = (v: { startsAt: string; endsAt: string }) =>
  !v.startsAt || !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt);
const localImage = text(200).regex(
  /^\/(concert-art\.png|api\/media\/[a-f0-9-]+\.(png|jpg|webp))$/,
);
export const contentSchema = z
  .object({
    schoolName: text(40).min(1),
    welcome: text(50),
    footer: text(120),
    lineUrl: z.union([
      z.literal(""),
      z
        .url()
        .max(1000)
        .refine((v) => /^https?:\/\//.test(v), "連結必須使用 http 或 https"),
    ]),
    qrLabel: text(50),
    roomIds: z.array(text(80).min(1)).max(50),
    hideEnded: z.boolean(),
    theme: z.enum(["cream", "mint"]),
    announcements: z
      .array(
        z
          .object({
            id: text(80).min(1),
            title: text(40).min(1),
            body: text(240).min(1),
            priority: z.enum(["normal", "urgent"]),
            ...windowFields,
          })
          .refine(validWindow, "下架時間必須晚於上架時間"),
      )
      .max(30),
    posters: z
      .array(
        z
          .object({
            id: text(80).min(1),
            title: text(50).min(1),
            subtitle: text(80),
            image: localImage,
            duration: z.number().int().min(8).max(120),
            ...windowFields,
          })
          .refine(validWindow, "下架時間必須晚於上架時間"),
      )
      .max(30),
  })
  .refine(
    (v) =>
      new Set(v.announcements.map((a) => a.id)).size ===
        v.announcements.length &&
      new Set(v.posters.map((p) => p.id)).size === v.posters.length,
    "內容 ID 重複",
  );
export const lessonSchema = z.object({
  id: text(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  course_name: text(100),
  teacher_name: text(80),
  room_id: text(80),
  room_name: text(80),
  status: z.enum(["scheduled", "completed", "cancelled"]),
});
