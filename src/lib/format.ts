// Display helpers. Trip dates are calendar days (YYYY-MM-DD from the date
// column), so they are formatted without a timezone shift.

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dayWithYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// "Oct 14 – 21, 2026" or "Dec 28, 2026 – Jan 4, 2027".
export function formatDateRange(startsAt: string, endsAt: string) {
  const start = new Date(`${startsAt}T00:00:00Z`);
  const end = new Date(`${endsAt}T00:00:00Z`);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${dayWithYear.format(start)} – ${dayWithYear.format(end)}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${day.format(start)} – ${dayWithYear.format(end)}`;
  }
  return `${day.format(start)} – ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

const statusLabels = {
  planned: "Planned",
  booked: "Booked",
  in_progress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
} as const;

export function tripStatusLabel(status: keyof typeof statusLabels) {
  return statusLabels[status];
}

// Segment times are shown in UTC with the zone named, since the traveller's
// timezone is not known on the server. "Oct 14, 22:55 UTC".
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function formatDateTime(value: Date) {
  return `${dateTime.format(value)} UTC`;
}

const kindLabels = { flight: "Flight", hotel: "Hotel", train: "Train" } as const;

export function segmentKindLabel(kind: keyof typeof kindLabels) {
  return kindLabels[kind];
}

const segmentStatusLabels = {
  scheduled: "Scheduled",
  delayed: "Delayed",
  rebooked: "Rebooked",
  cancelled: "Cancelled",
} as const;

export function segmentStatusLabel(status: keyof typeof segmentStatusLabels) {
  return segmentStatusLabels[status];
}

// Pill tones for statuses, shared by list and detail views.
export function tripStatusTone(status: keyof typeof statusLabels) {
  switch (status) {
    case "booked":
      return "accent" as const;
    case "in_progress":
      return "violet" as const;
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function segmentStatusTone(status: keyof typeof segmentStatusLabels) {
  switch (status) {
    case "delayed":
      return "warn" as const;
    case "cancelled":
      return "danger" as const;
    case "rebooked":
      return "accent" as const;
    default:
      return "neutral" as const;
  }
}

// "just now", "3h ago", "yesterday", "Sep 8". For lists of recent things.
export function formatRelative(value: Date | string, now = new Date()) {
  const date = new Date(value);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return day.format(date);
}
