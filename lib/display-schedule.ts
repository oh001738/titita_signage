import type { Lesson } from "@/types";

export function selectDisplayLessons(lessons: Lesson[], now: Date) {
  const currentTime = now.getTime();
  const withTimes = lessons.map((lesson) => ({
    lesson,
    start: Date.parse(`${lesson.date}T${lesson.start_time}:00+08:00`),
    end: Date.parse(`${lesson.date}T${lesson.end_time}:00+08:00`),
  }));
  const visible = withTimes
    .filter(
      ({ lesson, start, end }) =>
        lesson.status !== "completed" &&
        end > currentTime &&
        start <= currentTime + 60 * 60_000,
    )
    .sort((a, b) => a.start - b.start)
    .map(({ lesson }) => lesson);
  const next = withTimes
    .filter(
      ({ lesson, start }) =>
        lesson.status === "scheduled" && start > currentTime,
    )
    .sort((a, b) => a.start - b.start)[0]?.lesson;
  return {
    visible,
    next,
    hasScheduled: withTimes.some(({ lesson }) => lesson.status !== "cancelled"),
  };
}
