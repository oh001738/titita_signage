import type { CmsState, Content, Lesson } from "@/types";
export function defaultContent(): Content {
  return {
    schoolName: "TITITA 音樂教室",
    welcome: "歡迎來到音樂的日常",
    footer: "請依課程時間前往教室，讓音樂陪伴每一次成長。",
    lineUrl: "",
    qrLabel: "加入 LINE・查看課表與活動",
    roomIds: [],
    hideEnded: false,
    theme: "cream",
    announcements: [
      {
        id: "welcome",
        title: "教室公告",
        body: "歡迎來到 TITITA，課程與活動資訊歡迎洽詢櫃台。",
        priority: "normal",
        startsAt: "",
        endsAt: "",
      },
    ],
    posters: [
      {
        id: "concert",
        title: "小小音樂家",
        subtitle: "冬日成果發表會",
        image: "/concert-art.png",
        duration: 15,
        startsAt: "",
        endsAt: "",
      },
    ],
  };
}
export function defaultState(): CmsState {
  return {
    revision: 0,
    contentRevision: 0,
    draft: defaultContent(),
    published: null,
    previous: null,
    screens: [],
    pairCodes: [],
  };
}
export function mockLessons(date: string): Lesson[] {
  return [
    ["16:00", "17:00", "鋼琴個別課", "林老師", "A"],
    ["16:00", "17:00", "兒童音樂班", "陳老師", "B"],
    ["17:00", "18:00", "小提琴個別課", "王老師", "A"],
    ["17:30", "18:30", "快樂打擊樂", "李老師", "C"],
    ["18:00", "19:00", "爵士鋼琴個別課", "林老師", "B"],
    ["19:00", "20:00", "親子音樂探索", "陳老師", "C"],
  ].map(([start_time, end_time, course_name, teacher_name, room]) => ({
    id: `${date}-${room}-${start_time}`,
    date,
    start_time,
    end_time,
    course_name,
    teacher_name,
    room_id: room,
    room_name: `${room} 教室`,
    status: "scheduled",
  }));
}
