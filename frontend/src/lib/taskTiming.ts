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
