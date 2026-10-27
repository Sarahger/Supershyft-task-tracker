/** Format computed time-taken hours for display. */
export function formatTimeTakenHours(hours: number | null | undefined): string | null {
  if (hours == null || Number.isNaN(hours)) return null;
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return mins <= 0 ? '0m' : `${mins}m`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

/** Parse `1h`, `30m`, `1.5`, or `2h 30m` into hours. Empty input returns null. */
export function parseDurationInput(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  const combo = text.match(
    /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\s*(\d+)\s*(?:m|min|mins|minutes)$/,
  );
  if (combo) {
    const hours = Number(combo[1]) + Number(combo[2]) / 60;
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return Math.round(hours * 100) / 100;
  }

  const simple = text.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hour|hours)?$/);
  if (!simple) return null;
  const amount = Number(simple[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = simple[2];
  const hours = !unit || unit.startsWith('h') ? amount : amount / 60;
  return Math.round(hours * 100) / 100;
}
