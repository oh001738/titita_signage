export function taiwanDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function taiwanTime(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}
export function isActive(
  item: { startsAt: string; endsAt: string },
  now = new Date(),
): boolean {
  return (
    (!item.startsAt || Date.parse(item.startsAt) <= now.getTime()) &&
    (!item.endsAt || Date.parse(item.endsAt) > now.getTime())
  );
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
