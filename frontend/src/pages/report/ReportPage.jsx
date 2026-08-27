import React, { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  FileText,
  Flame,
  Sparkles,
  Target,
} from "lucide-react";

import { api } from "../../shared/api";
import { format, formatDuration } from "../../shared/format";
import {
  DATE_RANGE_STORAGE_KEYS,
  isValidDateRange,
  usePersistedDateRange,
} from "../../shared/usePersistedDateRange";
import {
  CategoryIcon,
  CinematicHeroArt,
  ErrorState,
  Loading,
  MetricCard,
  Shell,
} from "../../shared/ui";

const FIELD_CLASSES =
  "min-h-12 min-w-[180px] rounded-xl border border-white/14 bg-white/[0.08] px-3.5 text-sm text-white outline-none [color-scheme:dark] focus:border-[#71b9ff]/70 focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";
const ACTION_BUTTON_CLASSES =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.065] px-4 text-sm font-extrabold text-[#d9dfea] transition-[transform,background-color,border-color,color] hover:-translate-y-0.5 hover:border-[#58b5ff]/55 hover:bg-[#42a9ff]/14 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]";

function createDefaultReportRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { start: `${today.slice(0, 8)}01`, end: today };
}

function buildReportMarkdown(report) {
  const lines = [
    `# Детальный отчёт СЕО тела: ${report.start} — ${report.end}`,
    "",
    `Глобальный счёт закрытых дней на ${report.end}: ${Number(report.global_balance) >= 0 ? "+" : ""}${format(report.global_balance, 1)} ккал.`,
    "",
  ];
  const measure = report.latest_measurement;
  const weightDate = measure?.weight_measured_on || measure?.measured_on;
  const tapeDate = measure?.tape_measured_on || measure?.measured_on;
  lines.push(
    "## Крайняя биометрия",
    measure
      ? `- Вес (${weightDate || "дата не указана"}): ${measure.weight ?? "—"} кг. Замеры (${tapeDate || "дата не указана"}): талия ${measure.waist ?? "—"} см; живот ${measure.belly ?? "—"} см; плечи ${measure.shoulders ?? "—"} см; бицепс ${measure.biceps ?? "—"} см; грудь ${measure.chest ?? "—"} см; бёдра ${measure.hips ?? "—"} см; бедро ${measure.thigh ?? "—"} см.`
      : "- Замеры ещё не внесены.",
    "",
  );
  if (!report.days.length) {
    lines.push("За выбранный период данных нет.");
    return lines.join("\n");
  }
  report.days.forEach(({ day, summary, entries, workouts, sleep }) => {
    lines.push(
      `## ${day.log_date} — ${day.day_type} (${day.closed_at ? "закрыт" : "в процессе"})`,
      "",
      `- Сон: ${sleep?.has_data ? `${formatDuration(sleep.duration_minutes)} | SWS ${sleep.deep_percent ?? "—"}% | REM ${sleep.rem_percent ?? "—"}%` : "нет данных (часы не надевались или данные не внесены)"}.`,
      `- Расход: ${format(summary.tdee, 1)} ккал = база ${format(day.base_tdee, 1)} + шаги ${format(summary.steps_kcal, 1)} + силовая ${format(summary.workout_kcal, 1)} + дополнительная активность ${format(day.cardio_kcal, 1)} + ручная корректировка ${format(day.manual_adjustment, 1)}.`,
      `- Съедено: ${format(summary.intake, 1)} ккал; Б ${format(summary.protein, 1)} г; Ж ${format(summary.fat, 1)} г; У ${format(summary.carbs, 1)} г.`,
      `- Фактический баланс: ${summary.delta > 0 ? "+" : ""}${format(summary.delta, 1)} ккал. Целевой бюджет: ${format(summary.target, 1)} ккал; отклонение от цели: ${summary.budget_delta > 0 ? "+" : ""}${format(summary.budget_delta, 1)} ккал.`,
      "",
      "### Рацион",
    );
    if (!entries.length) lines.push("- Позиции не внесены.");
    entries.forEach((entry) => {
      const unit =
        entry.quantity_mode === "grams"
          ? "г"
          : entry.quantity_mode === "units"
            ? "шт."
            : "порц.";
      lines.push(
        `- ${entry.meal_type}: ${entry.product_name} — ${format(entry.quantity, 1)} ${unit}; ${format(entry.kcal, 1)} ккал; Б ${format(entry.protein, 1)}; Ж ${format(entry.fat, 1)}; У ${format(entry.carbs, 1)}.`,
      );
    });
    lines.push("", "### Тренировка");
    if (!workouts.length) lines.push("- Силовой тренировки нет.");
    workouts.forEach((workout) => {
      lines.push(
        `- ${workout.title}: ${format(workout.duration_minutes, 1)} мин, интенсивность ${format(workout.intensity_met, 1)} MET.`,
      );
      if (!workout.sets.length) lines.push("  - Подходы не внесены.");
      workout.sets.forEach((set) =>
        lines.push(
          `  - ${set.exercise}, подход ${set.set_number}: ${format(set.weight, 1)} кг × ${set.reps}${set.note ? `; ${set.note}` : ""}.`,
        ),
      );
      (workout.cardio || []).forEach((cardio) => {
        lines.push(
          `  - Кардио — ${cardio.activity_type}, ${format(cardio.duration_minutes, 1)} мин; часы: ${cardio.watch_steps ?? "—"} шагов, ${cardio.watch_kcal ?? "—"} ккал; расчётная оценка ${format(cardio.estimated_kcal, 1)} ккал (отдельно в TDEE не добавлена).`,
        );
        cardio.intervals.forEach((interval) =>
          lines.push(
            `    - ${format(interval.start_minute, 1)}–${format(interval.end_minute, 1)} мин: наклон ${format(interval.incline_percent, 1)}%, скорость ${format(interval.speed_kmh, 1)} км/ч.`,
          ),
        );
      });
    });
    if (day.note) lines.push("", `Заметка дня: ${day.note}`);
    lines.push("", "---", "");
  });
  return lines.join("\n");
}

export default function ReportPage() {
  const { range, setRange, saveRange } = usePersistedDateRange(
    DATE_RANGE_STORAGE_KEYS.report,
    createDefaultReportRange,
  );
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const latestRequest = useRef(0);
  const load = async (requestedRange = range) => {
    if (!isValidDateRange(requestedRange)) return;
    const requestId = ++latestRequest.current;
    setError("");
    try {
      const result = await api(
        `/api/report?start=${requestedRange.start}&end=${requestedRange.end}`,
      );
      if (requestId === latestRequest.current) {
        setReport(result);
        saveRange(requestedRange);
      }
    } catch (reason) {
      if (requestId === latestRequest.current) setError(reason.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  if (error)
    return (
      <Shell active="report" cinematic>
        <ErrorState error={error} retry={() => load()} />
      </Shell>
    );
  if (!report)
    return (
      <Shell active="report" cinematic>
        <Loading />
      </Shell>
    );
  const totalIntake = report.days.reduce(
    (sum, item) => sum + item.summary.intake,
    0,
  );
  const closedDays = report.days.filter((item) => item.day.closed_at);
  const officialBalance = closedDays.reduce(
    (sum, item) => sum + item.summary.delta,
    0,
  );
  const meaningfulOpenDays = report.days.filter(
    (item) =>
      !item.day.closed_at &&
      (item.summary.intake > 0 ||
        item.day.steps > 0 ||
        item.day.cardio_kcal > 0 ||
        item.workouts.length),
  );
  const markdown = buildReportMarkdown(report);
  async function copyReport() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("Не удалось скопировать отчёт. Скачай .md файл.");
    }
  }
  function downloadReport() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ceo-report-${report.start}-${report.end}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Shell active="report" cinematic>
      <div className="grid gap-4 text-[#f2f2f7]">
        <header
          className="cinematic-hero flex min-h-[260px] items-end justify-between gap-8 p-9"
          style={{ "--hero-accent": "#9186ff" }}
        >
          <CinematicHeroArt />
          <div className="relative z-1">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#a091ff]/30 bg-[#6d5dfc]/13 px-3.5 text-xs font-black tracking-[0.08em] text-[#c2baff] uppercase backdrop-blur-md">
              <FileText size={15} />
              Детальный отчёт
            </span>
            <h1 className="mt-5 mb-3 max-w-[820px] text-[clamp(40px,3.6vw,68px)] leading-[0.98] font-black tracking-[-0.05em] text-white text-balance">
              История без <span className="text-[#a99fff]">потери деталей</span>
            </h1>
            <p className="m-0 max-w-[700px] text-base leading-relaxed text-[#c3c6d1] text-pretty">
              Каждый продукт, состав тренировки и отдельный расход остаются
              видимыми для твоего анализа и LLM.
            </p>
          </div>
          <Sparkles className="relative z-1 text-[#9186ff] drop-shadow-[0_0_28px_rgba(109,93,252,0.6)]" size={78} />
        </header>
        <form
          className="flex flex-wrap items-end gap-3 py-1"
          onSubmit={(event) => {
            event.preventDefault();
            load(range);
          }}
        >
          <label className="grid gap-2 text-xs font-black text-[#b9bfcc] uppercase">
            С
            <input
              className={FIELD_CLASSES}
              type="date"
              value={range.start}
              max={range.end || undefined}
              onChange={(event) =>
                setRange({ ...range, start: event.target.value })
              }
              required
            />
          </label>
          <label className="grid gap-2 text-xs font-black text-[#b9bfcc] uppercase">
            По
            <input
              className={FIELD_CLASSES}
              type="date"
              value={range.end}
              min={range.start || undefined}
              onChange={(event) =>
                setRange({ ...range, end: event.target.value })
              }
              required
            />
          </label>
          <button className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#7c6dff] bg-[#6d5dfc]/20 px-5 text-sm font-black text-[#d8d3ff] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#6d5dfc]/28 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96]">
            Обновить
          </button>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${ACTION_BUTTON_CLASSES} ${copied ? "border-[#4ada97]/50 bg-[#4ada97]/12 text-[#9af1c9]" : ""}`}
              onClick={copyReport}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? "Скопировано" : "Для LLM"}
            </button>
            <button
              type="button"
              className={ACTION_BUTTON_CLASSES}
              onClick={downloadReport}
            >
              <Download size={17} /> Скачать .md
            </button>
          </span>
        </form>
        {copyError && <p className="m-0 text-sm text-[#ffb5c8]">{copyError}</p>}
        <section className="grid grid-cols-3 gap-3">
          <MetricCard
            icon={CalendarDays}
            label="Дней в отчёте"
            value={report.days.length}
            suffix={`${range.start} — ${range.end}`}
            appearance="cinematic"
          />
          <MetricCard
            icon={Flame}
            label="Всего съедено"
            value={format(totalIntake)}
            suffix="ккал за период"
            tone="pink"
            appearance="cinematic"
          />
          <MetricCard
            icon={Target}
            label="Баланс закрытых дней"
            value={`${officialBalance > 0 ? "+" : officialBalance < 0 ? "−" : ""}${format(Math.abs(officialBalance))}`}
            suffix={
              closedDays.length
                ? `${closedDays.length} дней зафиксировано`
                : "закрытых дней пока нет"
            }
            tone="cyan"
            appearance="cinematic"
          />
        </section>
        <div className="relative flex min-h-14 items-center gap-2 overflow-hidden rounded-2xl border border-[#ff4c67]/30 bg-[linear-gradient(90deg,rgba(255,64,95,0.14),rgba(255,255,255,0.045))] px-4 text-sm text-[#f3cbd2] shadow-[0_10px_30px_rgba(0,0,0,0.16)] after:absolute after:right-[-4%] after:bottom-0 after:left-[55%] after:h-px after:-rotate-2 after:bg-[#ff405f] after:shadow-[0_0_15px_3px_rgba(255,64,95,0.5)]">
          <Sparkles size={18} /> Глобальный счёт на {report.end}:{" "}
          <b>
            {report.global_balance > 0 ? "+" : ""}
            {format(report.global_balance)} ккал
          </b>
        </div>
        <section className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#2b9fe8]/20 bg-[#2b9fe8]/[0.07] px-4 text-[#8fd5ff]">
          <BarChart3 size={22} />
          <div className="grid gap-1">
            <small className="text-xs text-[#98a2b5]">Крайняя биометрия</small>
            {report.latest_measurement ? (
              <b className="text-sm text-[#f3f5fa]">
                Вес {report.latest_measurement.weight_measured_on || report.latest_measurement.measured_on}: {report.latest_measurement.weight ?? "—"} кг · Замеры {report.latest_measurement.tape_measured_on || report.latest_measurement.measured_on}: Талия{" "}
                {report.latest_measurement.waist ?? "—"} см · Живот{" "}
                {report.latest_measurement.belly ?? "—"} см · Плечи{" "}
                {report.latest_measurement.shoulders ?? "—"} см · Бицепс{" "}
                {report.latest_measurement.biceps ?? "—"} см
              </b>
            ) : (
              <b className="text-sm text-[#f3f5fa]">Замеры ещё не внесены</b>
            )}
          </div>
        </section>
        {meaningfulOpenDays.length > 0 && (
          <div className="rounded-xl border border-[#42a9ff]/20 bg-[#42a9ff]/[0.065] px-4 py-3 text-sm leading-relaxed text-[#a9c9e3]">
            Открытых дней: {meaningfulOpenDays.length}. Их текущая дельта видна
            ниже, но войдёт в глобальный счёт только после закрытия дня.
          </div>
        )}
        <section className="grid gap-4">
          {report.days.map(({ day, summary, entries, workouts, sleep }) => (
            <article className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,26,41,0.97),rgba(9,14,24,0.97))] shadow-[0_17px_42px_rgba(0,0,0,0.24)] before:absolute before:top-0 before:left-0 before:h-[78px] before:w-1 before:bg-[#42a9ff] before:shadow-[0_0_19px_rgba(66,169,255,0.58)]" key={day.id}>
              <header className="flex items-center justify-between gap-5 border-b border-white/[0.08] bg-white/[0.018] px-6 py-5">
                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black tracking-[0.08em] uppercase ${day.closed_at ? "bg-[#41c484]/14 text-[#71dba6]" : "bg-[#2ea0e8]/16 text-[#73c5fa]"}`}
                  >
                    {day.closed_at ? "закрыт" : "в процессе"}
                  </span>
                  <h2 className="mt-2 mb-0 text-2xl font-black text-white">
                    {day.log_date} · {day.day_type}
                  </h2>
                </div>
                <strong className={`text-2xl font-black tabular-nums ${summary.delta > 0 ? "text-[#ff8c9f] drop-shadow-[0_0_16px_rgba(255,64,95,0.3)]" : "text-[#7be0b3] drop-shadow-[0_0_16px_rgba(67,215,146,0.24)]"}`}>
                  {summary.delta > 0 ? "+" : ""}
                  {format(summary.delta)} ккал
                </strong>
              </header>
              <div className="flex flex-wrap gap-2 bg-[linear-gradient(90deg,rgba(255,255,255,0.035),transparent)] px-5 py-4">
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-xs text-[#abb0bd]">
                  База <b>{format(day.base_tdee)}</b>
                </span>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-xs text-[#abb0bd]">
                  Шаги <b>+{format(summary.steps_kcal)}</b>
                </span>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-xs text-[#abb0bd]">
                  Зал <b>+{format(summary.workout_kcal)}</b>
                </span>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-xs text-[#abb0bd]">
                  Доп. активность <b>+{format(day.cardio_kcal)}</b>
                </span>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-xs text-[#abb0bd]">
                  Расход <b>{format(summary.tdee)}</b>
                </span>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-xs text-[#abb0bd]">
                  Съедено <b>{format(summary.intake)}</b>
                </span>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-xs text-[#abb0bd]">
                  Белок <b>{format(summary.protein, 1)} г</b>
                </span>
              </div>
              <div className="mx-5 mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-[#2b9fe8]/20 bg-[#2b9fe8]/[0.07] px-4 text-[#8fd5ff]">
                <Clock3 size={18} />
                <span className="text-sm text-[#aeb6c6]">Сон</span>
                <b className="text-sm text-[#f2f4fa]">
                  {sleep?.has_data
                    ? `${formatDuration(sleep.duration_minutes)} · SWS ${sleep.deep_percent ?? "—"}% · REM ${sleep.rem_percent ?? "—"}%`
                    : "данных нет"}
                </b>
              </div>
              <div className="border-b border-white/[0.08] px-5 py-5">
                <h3 className="mt-0 mb-3 text-base font-black text-white">Рацион · {entries.length} позиций</h3>
                {entries.length ? (
                  entries.map((entry) => (
                    <div className="grid min-h-12 grid-cols-[34px_90px_minmax(190px,1fr)_90px_auto] items-center gap-3 border-t border-white/[0.06] py-2 text-sm transition-[transform,background-color] hover:translate-x-0.5 hover:rounded-xl hover:bg-[#42a9ff]/[0.065] hover:px-2" key={entry.id}>
                      <CategoryIcon product={entry} size={17} />
                      <span className="text-xs text-[#9da2b1]">{entry.meal_type}</span>
                      <b className="text-white">{entry.product_name}</b>
                      <small className="text-xs text-[#9da2b1]">
                        {format(entry.quantity, 1)}{" "}
                        {entry.quantity_mode === "grams"
                          ? "г"
                          : entry.quantity_mode === "units"
                            ? "шт."
                            : "порц."}
                      </small>
                      <em className="text-sm text-white not-italic whitespace-nowrap tabular-nums">
                        {format(entry.kcal, 1)} ккал ·{" "}
                        {format(entry.protein, 1)} Б
                      </em>
                    </div>
                  ))
                ) : (
                  <p className="m-0 text-sm text-[#969cab]">Рацион не внесён.</p>
                )}
              </div>
              <div className="px-5 py-5">
                <h3 className="mt-0 mb-3 text-base font-black text-white">Тренировки · расход {format(summary.workout_kcal)} ккал</h3>
                {workouts.length ? (
                  workouts.map((workout) => (
                    <section key={workout.id}>
                      <div className="mt-1 flex justify-between gap-3 py-2 text-sm text-white">
                        <b>{workout.title}</b>
                        <span className="text-xs text-[#9da2b1]">
                          {format(workout.duration_minutes)} мин · MET{" "}
                          {format(workout.intensity_met, 1)}
                        </span>
                      </div>
                      {workout.sets.length ? (
                        <div className="flex flex-wrap gap-2">
                          {workout.sets.map((set) => (
                            <span className="rounded-lg border border-[#ff405f]/16 bg-[#ff405f]/10 px-2.5 py-2 text-xs text-[#f1c0d3]" key={set.id}>
                              {set.exercise}:{" "}
                              <b>
                                {format(set.weight)} × {set.reps}
                              </b>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <small className="text-xs text-[#9da2b1]">Подходы пока не внесены.</small>
                      )}
                      {(workout.cardio || []).map((cardio) => (
                        <div className="mt-3 grid gap-2 rounded-xl border border-[#5baee8]/20 bg-[#3f8bc4]/[0.07] p-3" key={cardio.id}>
                          <b className="text-sm text-[#dcecff]">
                            {cardio.activity_type} ·{" "}
                            {format(cardio.duration_minutes)} мин
                          </b>
                          <small className="text-xs text-[#aebbd0]">
                            Часы: {cardio.watch_steps ?? "—"} шагов ·{" "}
                            {cardio.watch_kcal ?? "—"} ккал · отдельно в TDEE не
                            добавлено
                          </small>
                          {cardio.intervals.map((interval) => (
                            <span className="text-xs text-[#8fbddd]" key={interval.id}>
                              {format(interval.start_minute, 1)}–
                              {format(interval.end_minute, 1)} мин: наклон{" "}
                              {format(interval.incline_percent, 1)}% ·{" "}
                              {format(interval.speed_kmh, 1)} км/ч
                            </span>
                          ))}
                        </div>
                      ))}
                    </section>
                  ))
                ) : (
                  <p className="m-0 text-sm text-[#969cab]">Силовой тренировки в этот день нет.</p>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </Shell>
  );
}
