import { format } from "./format";

export function deficitStatus(data) {
  const intakeReady =
    data.day.closed_at || data.summary.intake >= data.summary.target * 0.7;
  const deficit = Math.max(0, -data.summary.delta);
  if (intakeReady && data.summary.budget_delta > 0) {
    return {
      key: "red",
      color: "#ee4d54",
      title:
        data.summary.delta > 0 ? "Расход превышен" : "Цель дефицита не добрана",
      caption:
        data.summary.delta > 0
          ? `Сейчас +${format(data.summary.delta)} ккал к расходу. Проверь записи и активность.`
          : `${format(data.summary.budget_delta)} ккал выше целевого бюджета, но фактический дефицит ещё ${format(deficit)} ккал.`,
    };
  }
  if (!intakeReady || deficit < 150) {
    return {
      key: "blue",
      color: "#2b9fe8",
      title: "Операция идёт",
      caption: "Собираем день спокойно и без ранних выводов.",
    };
  }
  if (deficit < 400) {
    return {
      key: "green",
      color: "#44c786",
      title: "Точный контроль",
      caption: `Дефицит ${format(deficit)} ккал — чистая работа.`,
    };
  }
  if (deficit < 650) {
    return {
      key: "yellow",
      color: "#f2bd32",
      title: "Золотая зона",
      caption: `Дефицит ${format(deficit)} ккал — прямо в целевом коридоре.`,
    };
  }
  return {
    key: "red",
    color: "#ee4d54",
    title: "Жёсткий режим",
    caption: `Дефицит ${format(deficit)} ккал — проверь сон, восстановление и белок.`,
  };
}
