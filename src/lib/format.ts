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
