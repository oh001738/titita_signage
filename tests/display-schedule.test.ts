import { describe, expect, it } from "vitest";
import { selectDisplayLessons } from "@/lib/display-schedule";
import type { Lesson } from "@/types";

const now = new Date("2026-11-05T14:00:00+08:00");
function lesson(
  id: string,
  start_time: string,
  end_time: string,
  status: Lesson["status"] = "scheduled",
): Lesson {
  return {
    id,
    date: "2026-11-05",
    start_time,
    end_time,
    status,
    course_name: id,
    teacher_name: "老師",
    room_id: "a",
    room_name: "教室",
  };
}
describe("selectDisplayLessons", () => {
  it("shows active lessons and those starting within one hour, ordered by time", () => {
    const result = selectDisplayLessons(
      [
        lesson("later", "15:01", "16:00"),
        lesson("boundary", "15:00", "16:00"),
        lesson("active", "13:30", "14:30"),
        lesson("ended", "13:00", "14:00"),
      ],
      now,
    );
    expect(result.visible.map((item) => item.id)).toEqual([
      "active",
      "boundary",
    ]);
  });
  it("selects the earliest upcoming scheduled lesson when the next hour is empty", () => {
    const result = selectDisplayLessons(
      [
        lesson("later", "17:00", "18:00"),
        lesson("cancelled", "15:10", "16:00", "cancelled"),
        lesson("next", "15:30", "16:30"),
      ],
      now,
    );
    expect(result.visible).toEqual([]);
    expect(result.next?.id).toBe("next");
  });
  it("distinguishes an empty day from a completed day", () => {
    expect(selectDisplayLessons([], now).hasScheduled).toBe(false);
    expect(
      selectDisplayLessons(
        [lesson("finished", "12:00", "13:00", "completed")],
        now,
      ).hasScheduled,
    ).toBe(true);
  });
});
