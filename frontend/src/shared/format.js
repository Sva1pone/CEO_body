export const format = (value, digits = 0) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(
    Number(value || 0),
  );

export function formatDuration(minutes) {
  if (minutes == null) return "время рассчитается автоматически";
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}
