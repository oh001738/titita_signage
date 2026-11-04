export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "urgent";
  startsAt: string;
  endsAt: string;
}
export interface Poster {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  duration: number;
  startsAt: string;
  endsAt: string;
}
export interface AwardRecipient {
  id: string;
  name: string;
  category: string;
  prize: string;
}
export interface Award {
  id: string;
  layout: "individual" | "group" | "competition";
  competition: string;
  sharedPrize: string;
  image: string;
  enabled: boolean;
  duration: number;
  startsAt: string;
  endsAt: string;
  recipients: AwardRecipient[];
}
export interface Content {
  schoolName: string;
  welcome: string;
  footer: string;
  lineUrl: string;
  qrLabel: string;
  roomIds: string[];
  hideEnded: boolean;
  theme: "cream" | "mint";
  announcements: Announcement[];
  posters: Poster[];
  awards?: Award[];
}
export interface Publication {
  version: number;
  publishedAt: string;
  content: Content;
}
export interface Screen {
  id: string;
  name: string;
  tokenHash: string;
  enabled: boolean;
  lastSeen: string | null;
  contentVersion: number | null;
}
export interface PairCode {
  hash: string;
  screenId: string;
  expiresAt: string;
}
export interface PendingPairing {
  codeHash: string;
  tokenHash: string;
  expiresAt: string;
}
export interface CmsState {
  revision: number;
  contentRevision: number;
  draft: Content;
  published: Publication | null;
  previous: Publication | null;
  screens: Screen[];
  pairCodes: PairCode[];
  pendingPairings?: PendingPairing[];
}
export interface Lesson {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  course_name: string;
  teacher_name: string;
  room_id: string;
  room_name: string;
  status: "scheduled" | "completed" | "cancelled";
}
export interface Schedule {
  date: string;
  fetchedAt: string | null;
  source: "mock" | "onecloud";
  stale: boolean;
  lessons: Lesson[];
  error: string | null;
}
export interface DisplayPayload {
  content: Content;
  version: number;
  schedule: Schedule;
  serverTime: string;
}
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
