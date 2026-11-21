import type { Announcement } from "@/types";

/** Playback state is kept by ID, not list index, so live reorder does not
 * unexpectedly interrupt the notice the viewer is currently reading. */
export interface AnnouncementPlayback {
  mode: "normal" | "urgent" | null;
  currentId: string | null;
  resumeId: string | null;
  resumeOrder: string[];
  generation: number;
  normalOrder: string[];
  urgentOrder: string[];
}
export function initialAnnouncementPlayback(): AnnouncementPlayback {
  return {
    mode: null,
    currentId: null,
    resumeId: null,
    resumeOrder: [],
    generation: 0,
    normalOrder: [],
    urgentOrder: [],
  };
}
const equal = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** When the current item has disappeared, choose its next surviving former
 * neighbour; if none survived, begin at the top of the current list. */
function successor(
  id: string | null,
  previous: readonly string[],
  current: readonly string[],
) {
  if (!current.length) return null;
  const index = id === null ? -1 : previous.indexOf(id);
  if (index >= 0) {
    for (let step = 1; step < previous.length; step++) {
      const candidate = previous[(index + step) % previous.length];
      if (current.includes(candidate)) return candidate;
    }
  }
  return current[0];
}

export function reconcileAnnouncements(
  state: AnnouncementPlayback,
  active: readonly Announcement[],
): AnnouncementPlayback {
  const normalOrder = active
    .filter((item) => item.priority === "normal")
    .map((item) => item.id);
  const urgentOrder = active
    .filter((item) => item.priority === "urgent")
    .map((item) => item.id);
  const mode = urgentOrder.length
    ? "urgent"
    : normalOrder.length
      ? "normal"
      : null;
  let currentId = state.currentId;
  let resumeId = state.resumeId;
  let resumeOrder = state.resumeOrder;
  let restart = false;

  if (mode === "urgent" && state.mode !== "urgent") {
    resumeId = state.mode === "normal" ? state.currentId : null;
    resumeOrder = state.mode === "normal" ? state.normalOrder : normalOrder;
    currentId = urgentOrder[0];
    restart = true;
  } else if (mode === "normal" && state.mode === "urgent") {
    currentId =
      resumeId && normalOrder.includes(resumeId)
        ? resumeId
        : successor(resumeId, resumeOrder, normalOrder);
    resumeId = null;
    resumeOrder = [];
    restart = true;
  } else if (mode === "urgent") {
    if (!currentId || !urgentOrder.includes(currentId)) {
      currentId = successor(currentId, state.urgentOrder, urgentOrder);
      restart = true;
    }
  } else if (mode === "normal") {
    if (
      state.mode !== "normal" ||
      !currentId ||
      !normalOrder.includes(currentId)
    ) {
      currentId = successor(currentId, state.normalOrder, normalOrder);
      restart = true;
    }
  } else {
    if (state.currentId !== null) restart = true;
    currentId = null;
    resumeId = null;
    resumeOrder = [];
  }
  if (
    !restart &&
    mode === state.mode &&
    resumeId === state.resumeId &&
    equal(resumeOrder, state.resumeOrder) &&
    equal(normalOrder, state.normalOrder) &&
    equal(urgentOrder, state.urgentOrder)
  )
    return state;
  return {
    mode,
    currentId,
    resumeId,
    resumeOrder,
    normalOrder,
    urgentOrder,
    generation: state.generation + (restart ? 1 : 0),
  };
}

export function advanceAnnouncement(
  state: AnnouncementPlayback,
  active: readonly Announcement[],
): AnnouncementPlayback {
  const reconciled = reconcileAnnouncements(state, active);
  // An intervening schedule update has already selected a new notice; give it
  // a full turn instead of applying the obsolete timer tick to it.
  if (reconciled.generation !== state.generation) return reconciled;
  const order =
    reconciled.mode === "urgent"
      ? reconciled.urgentOrder
      : reconciled.normalOrder;
  if (order.length < 2 || !reconciled.currentId) return reconciled;
  const index = order.indexOf(reconciled.currentId);
  return {
    ...reconciled,
    currentId: order[(index + 1) % order.length],
    generation: reconciled.generation + 1,
  };
}
