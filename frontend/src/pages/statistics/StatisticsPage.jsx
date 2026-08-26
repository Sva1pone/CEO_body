import React, { useEffect, useRef, useState } from "react";
import { BarChart3, HelpCircle } from "lucide-react";

import { api } from "../../shared/api";
import { format } from "../../shared/format";
import {
  DATE_RANGE_STORAGE_KEYS,
  isValidDateRange,
  usePersistedDateRange,
} from "../../shared/usePersistedDateRange";
import {
  CinematicHeroArt,
  ErrorState,
  Loading,
  Shell,
} from "../../shared/ui";

const EMPTY_STATE_CLASSES =
  "grid min-h-[150px] place-content-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 text-center text-sm text-[#8f9bad]";
const STATS_CARD_CLASSES =
  "min-w-0 overflow-hidden rounded-[22px] border border-[#65a5e2]/20 bg-[linear-gradient(145deg,rgba(20,29,45,0.97),rgba(8,13,23,0.97))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";
const FIELD_CLASSES =
  "min-h-12 w-full rounded-xl border border-white/14 bg-[#171f2e] px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-[#71b9ff]/70 focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";

function createDefaultStatisticsRange() {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 89);
  return { start: startDate.toISOString().slice(0, 10), end: today };
}

function BalanceChart({ points }) {
  if (!points?.length)
    return (
      <div className={EMPTY_STATE_CLASSES}>
        Закрытых дней в выбранном периоде пока нет.
      </div>
    );
  const width = 920,
    height = 270,
    padX = 54,
    padY = 30;
  const values = points.map((item) => Number(item.balance));
  const rawMin = Math.min(0, ...values),
    rawMax = Math.max(0, ...values);
  const span = Math.max(200, rawMax - rawMin);
  const min = rawMin - span * 0.08,
    max = rawMax + span * 0.08;
  const x = (index) =>
    padX +
    (points.length === 1
      ? 0
      : (index / (points.length - 1)) * (width - padX * 2));
  const y = (value) =>
    padY + ((max - value) / (max - min)) * (height - padY * 2);
  const path = points
    .map((item, index) => `${index ? "L" : "M"} ${x(index)} ${y(item.balance)}`)
    .join(" ");
  const zeroY = y(0);
  const labels = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ];
  return (
    <div className="mt-4 w-full min-w-0 overflow-x-auto">
      <svg
        className="block h-auto w-full min-w-[680px]"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="График глобального баланса закрытых дней"
      >
        <defs>
          <linearGradient id="balanceStroke" x1="0" x2="1">
            <stop stopColor="#4eb7ff" />
            <stop offset=".52" stopColor="#8e6cff" />
            <stop offset="1" stopColor="#ff5f67" />
          </linearGradient>
        </defs>
        <line
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="6 6"
          x1={padX}
          y1={zeroY}
          x2={width - padX}
          y2={zeroY}
        />
        <text fill="#8493a8" fontSize="10" x={8} y={zeroY - 7}>
          0 ккал
        </text>
        <path fill="none" stroke="rgba(89,175,255,0.18)" strokeWidth="12" d={path} />
        <path fill="none" stroke="url(#balanceStroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d={path} />
        {points.map((item, index) => (
          <g key={`${item.date}-${index}`}>
            <circle
              fill={item.balance <= 0 ? "#62dc9e" : "#f0c659"}
              stroke={item.balance <= 0 ? "#c5ffe1" : "#fff1b4"}
              strokeWidth="1.5"
              cx={x(index)}
              cy={y(item.balance)}
              r={index === points.length - 1 ? 6 : 3.5}
            >
              <title>
                {item.date}: {item.balance > 0 ? "+" : ""}
                {format(item.balance)} ккал
              </title>
            </circle>
          </g>
        ))}
        {labels.map((index) => (
          <text
            key={index}
            fill="#aab8cb"
            fontSize="10"
            x={x(index)}
            y={height - 5}
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {points[index].date.slice(5).split("-").reverse().join(".")}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ProteinPeriods({ items, target }) {
  if (!items.length)
    return <div className={EMPTY_STATE_CLASSES}>Нет заполненных дней за период.</div>;
  const ceiling = Math.max(
    target * 1.35,
    ...items.map((item) =>
      Math.max(item.average_protein, item.target_average || target),
    ),
  );
  return (
    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
      {items.map((item) => {
        const periodTarget = item.target_average || target;
        return (
          <article
            key={item.key}
            className={`grid gap-3 rounded-2xl border bg-white/[0.035] p-4 ${item.compensated ? "border-[#55d394]/30" : "border-[#f1666a]/30"}`}
          >
            <header className="flex items-center justify-between gap-2">
              <b className="text-sm font-black text-white">{item.label}</b>
              <span className="text-xs text-[#8998ad]">
                {item.logged_days}/{item.expected_days} дней
              </span>
            </header>
            <div className="relative h-2 overflow-visible rounded-full bg-white/[0.08]">
              <span
                className={`block h-full rounded-[inherit] ${item.compensated ? "bg-[linear-gradient(90deg,#5a8ef1,#66dfaa)]" : "bg-[linear-gradient(90deg,#7c6cf0,#ed6b72)]"}`}
                style={{
                  width: `${Math.min(100, (item.average_protein / ceiling) * 100)}%`,
                }}
              />
              <i className="absolute top-[-3px] h-3.5 w-0.5 bg-white shadow-[0_0_7px_rgba(255,255,255,0.65)]" style={{ left: `${(periodTarget / ceiling) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <strong className="text-lg font-black text-white tabular-nums">{format(item.average_protein, 1)} г/день</strong>
              <small className="max-w-[155px] text-right text-xs leading-snug text-[#aab7c8]">
                {item.compensated
                  ? "недельная норма компенсирована"
                  : `не хватает ${format(Math.max(0, item.target_for_logged_days - item.total_protein), 1)} г по заполненным дням`}
              </small>
            </div>
            <footer className="flex items-center justify-between gap-2 text-xs text-[#8998ad]">
              <span>
                Норму закрыто: {item.days_met}/{item.logged_days}
              </span>
              <span>Полнота {item.coverage_percent}%</span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

function TrainingStatistics({ training }) {
  const { summary, weekly, muscles, exercises, method } = training;
  if (!summary.sessions)
    return (
      <div className={EMPTY_STATE_CLASSES}>
        В выбранном периоде силовых тренировок нет.
      </div>
    );
  const maxWeekVolume = Math.max(1, ...weekly.map((item) => item.volume));
  const maxMuscleLoad = Math.max(
    1,
    ...muscles.map((item) => item.set_equivalents),
  );
  return (
    <div className="mt-4 grid gap-4">
      <div className="grid grid-cols-5 gap-2.5">
        <article className="grid min-h-[118px] gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <small className="text-xs text-[#91a0b4]">Тренировки</small>
          <strong className="text-3xl font-black text-white tabular-nums">{summary.sessions}</strong>
          <span className="self-end text-xs text-[#91a0b4]">{format(summary.duration_minutes)} мин</span>
        </article>
        <article className="grid min-h-[118px] gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <small className="text-xs text-[#91a0b4]">Рабочие подходы</small>
          <strong className="text-3xl font-black text-white tabular-nums">{summary.working_sets}</strong>
          <span className="self-end text-xs text-[#91a0b4]">разминка: {summary.warmup_sets}</span>
        </article>
        <article className="grid min-h-[118px] gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <small className="text-xs text-[#91a0b4]">Повторения</small>
          <strong className="text-3xl font-black text-white tabular-nums">{format(summary.reps)}</strong>
          <span className="self-end text-xs text-[#91a0b4]">с ненулевым результатом</span>
        </article>
        <article className="grid min-h-[118px] gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <small className="text-xs text-[#91a0b4]">Объём</small>
          <strong className="text-3xl font-black text-white tabular-nums">{format(summary.volume)}</strong>
          <span className="self-end text-xs text-[#91a0b4]">кг × повторения</span>
        </article>
        <article className="grid min-h-[118px] gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <small className="text-xs text-[#91a0b4]">Кардио</small>
          <strong className="text-3xl font-black text-white tabular-nums">{summary.cardio_sessions}</strong>
          <span className="self-end text-xs text-[#91a0b4]">{format(summary.cardio_minutes)} мин</span>
        </article>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#040911]/30 p-4">
          <h3 className="mt-0 mb-3 text-lg font-black text-white">Нагрузка по неделям</h3>
          {weekly.map((item) => (
            <article className="grid gap-2 border-t border-white/[0.06] py-3" key={item.key}>
              <header className="flex justify-between gap-2">
                <b className="text-sm text-white">{item.label}</b>
                <span className="text-xs text-[#91a0b4]">
                  {item.sessions} трен. · {item.sets} подх.
                </span>
              </header>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <i
                  className="block h-full rounded-[inherit] bg-[linear-gradient(90deg,#5d7cf0,#52c9ef)]"
                  style={{ width: `${(item.volume / maxWeekVolume) * 100}%` }}
                />
              </div>
              <strong className="text-sm text-[#dfe8f5]">
                {format(item.volume)} <small className="text-xs text-[#91a0b4]">объёма</small>
              </strong>
            </article>
          ))}
        </section>
        <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#040911]/30 p-4">
          <h3 className="mt-0 mb-3 text-lg font-black text-white">Распределение по мышцам</h3>
          {muscles.map((item) => (
            <article className="grid gap-2 border-t border-white/[0.06] py-3" key={item.muscle}>
              <header className="flex justify-between gap-2">
                <b className="text-sm text-white">{item.muscle}</b>
                <span className="text-xs text-[#91a0b4]">{format(item.set_equivalents, 1)} экв. подх.</span>
              </header>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <i
                  className="block h-full rounded-[inherit] bg-[linear-gradient(90deg,#755ff0,#ed658b)]"
                  style={{
                    width: `${(item.set_equivalents / maxMuscleLoad) * 100}%`,
                  }}
                />
              </div>
              <small className="text-xs text-[#91a0b4]">
                {item.primary_sets} основных · {item.secondary_sets} вторичных
              </small>
            </article>
          ))}
          {!muscles.length && (
            <p className="text-sm text-[#91a0b4]">У упражнений пока не настроены работающие мышцы.</p>
          )}
        </section>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-[minmax(250px,2fr)_100px_150px_120px_minmax(170px,1fr)] items-center gap-3 px-3 pb-2 text-xs font-black tracking-[0.06em] text-[#78899f] uppercase">
          <span>Упражнение</span>
          <span>Тренировки</span>
          <span>Подходы</span>
          <span>Объём</span>
          <span>Макс. вес / 1RM</span>
        </div>
        {exercises.map((item) => (
          <article className="grid min-w-[860px] grid-cols-[minmax(250px,2fr)_100px_150px_120px_minmax(170px,1fr)] items-center gap-3 border-t border-white/[0.07] px-3 py-3 text-sm text-[#9cacc0]" key={item.exercise}>
            <b className="text-white">{item.exercise}</b>
            <span>{item.sessions}</span>
            <span>
              {item.sets} · {item.reps} повт.
            </span>
            <strong className="text-white">{format(item.volume)}</strong>
            <span>
              {format(item.max_weight, 1)} / {format(item.estimated_1rm, 1)} кг
            </span>
          </article>
        ))}
      </div>
      <p className="m-0 flex items-start gap-2 rounded-xl bg-[#4b9ddc]/10 px-4 py-3 text-sm leading-relaxed text-[#9db1c9]">
        <HelpCircle className="mt-0.5 shrink-0 text-[#7ac9ff]" size={16} />
        <span>
          <b>Как считается:</b> {method.volume}; мышцы — {method.muscle_load}.{" "}
          {summary.unclassified_sets
            ? `Без профиля мышц: ${summary.unclassified_sets} подх.`
            : "Все рабочие подходы классифицированы."}
        </span>
      </p>
    </div>
  );
}

export default function StatisticsPage() {
  const { range, setRange, saveRange } = usePersistedDateRange(
    DATE_RANGE_STORAGE_KEYS.statistics,
    createDefaultStatisticsRange,
  );
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [productMode, setProductMode] = useState("popular");
  const latestRequest = useRef(0);
  const load = async (requestedRange = range) => {
    if (!isValidDateRange(requestedRange)) return;
    const requestId = ++latestRequest.current;
    setError("");
    try {
      const result = await api(
        `/api/statistics?start=${requestedRange.start}&end=${requestedRange.end}`,
      );
      if (requestId === latestRequest.current) {
        setData(result);
        saveRange(requestedRange);
      }
    } catch (reason) {
      if (requestId === latestRequest.current) setError(reason.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  if (error && !data)
    return (
      <Shell active="statistics" cinematic>
        <ErrorState error={error} retry={() => load()} />
      </Shell>
    );
  if (!data)
    return (
      <Shell active="statistics" cinematic>
        <Loading />
      </Shell>
    );
  const products = [...data.products].sort((a, b) =>
    productMode === "popular"
      ? b.uses - a.uses
      : (b.value_score ?? -1) - (a.value_score ?? -1),
  );
  const balance = data.summary.current_global_balance;
  return (
    <Shell active="statistics" cinematic>
      <div className="grid min-w-0 max-w-full gap-5 text-[#f4f7fc]">
        <header
          className="cinematic-hero flex min-h-[260px] items-end justify-between gap-8 p-9"
          style={{ "--hero-accent": "#4ed8c5" }}
        >
          <CinematicHeroArt />
          <div>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#67bfff]/30 bg-[#4ba9ef]/12 px-3.5 text-xs font-black tracking-[0.08em] text-[#9ed6ff] uppercase">
              <BarChart3 size={15} />
              Аналитика Сушки 4.0
            </span>
            <h1 className="mt-5 mb-3 max-w-[820px] text-[clamp(40px,3.6vw,68px)] leading-[0.96] font-black tracking-[-0.05em] text-white text-balance">
              Не отдельные дни, а <span className="text-[#69bfff]">система</span>
            </h1>
            <p className="m-0 max-w-[760px] text-base leading-relaxed text-[#b8c5d7] text-pretty">
              Белок оценивается по заполненным неделям, а официальный глобальный
              счёт — только по закрытым дням.
            </p>
          </div>
          <form
            className="grid min-w-[430px] grid-cols-2 gap-3 rounded-[18px] border border-white/10 bg-[#050a13]/70 p-4 backdrop-blur-xl"
            onSubmit={(event) => {
              event.preventDefault();
              load(range);
            }}
          >
            <label className="grid gap-2 text-xs font-black tracking-[0.08em] text-[#9eacc0] uppercase">
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
            <label className="grid gap-2 text-xs font-black tracking-[0.08em] text-[#9eacc0] uppercase">
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
            <button className="col-span-2 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#5a8ef1]/65 bg-[#5a8ef1]/18 px-5 text-sm font-black text-[#c8e5ff] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#5a8ef1]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.97]">Пересчитать</button>
          </form>
        </header>
        <section className="grid grid-cols-4 gap-3">
          <article className="grid min-h-[145px] gap-1 rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(27,37,57,0.95),rgba(12,18,30,0.96))] p-5">
            <small className="text-sm text-[#9eacc0]">Средний белок</small>
            <strong className="text-[clamp(28px,2.2vw,40px)] leading-tight font-black text-white tabular-nums">
              {format(data.summary.average_protein, 1)} <i className="text-[0.48em] font-bold text-[#91a4bc] not-italic">г</i>
            </strong>
            <span className="self-end text-xs text-[#aab7c9]">
              цель {format(data.targets.protein_min)}–
              {format(data.targets.protein_max)} г
            </span>
          </article>
          <article className="grid min-h-[145px] gap-1 rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(27,37,57,0.95),rgba(12,18,30,0.96))] p-5">
            <small className="text-sm text-[#9eacc0]">Дней с нормой</small>
            <strong className="text-[clamp(28px,2.2vw,40px)] leading-tight font-black text-white tabular-nums">
              {data.summary.protein_days_met}
              <i className="text-[0.48em] font-bold text-[#91a4bc] not-italic">/{data.summary.logged_days}</i>
            </strong>
            <span className="self-end text-xs text-[#aab7c9]">среди дней с рационом</span>
          </article>
          <article className="grid min-h-[145px] gap-1 rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(27,37,57,0.95),rgba(12,18,30,0.96))] p-5">
            <small className="text-sm text-[#9eacc0]">Глобальный счёт</small>
            <strong className={`text-[clamp(28px,2.2vw,40px)] leading-tight font-black tabular-nums ${balance <= 0 ? "text-[#6be4a6]" : "text-[#f0c659]"}`}>
              {balance > 0 ? "+" : ""}
              {format(balance)} <i className="text-[0.48em] font-bold text-[#91a4bc] not-italic">ккал</i>
            </strong>
            <span className="self-end text-xs text-[#aab7c9]">
              {balance <= 0
                ? "официальный чистый дефицит"
                : "остаток прежнего профицитного буфера"}
            </span>
          </article>
          <article className="grid min-h-[145px] gap-1 rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(27,37,57,0.95),rgba(12,18,30,0.96))] p-5">
            <small className="text-sm text-[#9eacc0]">Эквивалент жира</small>
            <strong className="text-[clamp(28px,2.2vw,40px)] leading-tight font-black text-white tabular-nums">
              {format(data.summary.estimated_fat_kg, 3)} <i className="text-[0.48em] font-bold text-[#91a4bc] not-italic">кг</i>
            </strong>
            <span className="self-end text-xs text-[#aab7c9]">оценка: 7 500 ккал/кг</span>
          </article>
        </section>
        <section className={STATS_CARD_CLASSES}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#69bfff] uppercase">Глобальный метаболический счёт</p>
              <h2 className="m-0 text-2xl font-black text-white">Буфер → чистый дефицит</h2>
              <p className="mt-2 mb-0 text-sm leading-relaxed text-[#a9b6c8]">Незакрытые дни намеренно не попадают на эту линию.</p>
            </div>
            <span className="rounded-full bg-[#4fa6ed]/12 px-3 py-2 text-xs font-bold text-[#8fcfff]">
              {data.summary.closed_days} закрытых дней
            </span>
          </div>
          <BalanceChart points={data.global_curve} />
        </section>
        <section className={STATS_CARD_CLASSES}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#69bfff] uppercase">Белковый баланс</p>
              <h2 className="m-0 text-2xl font-black text-white">Компенсация по неделям</h2>
              <p className="mt-2 mb-0 max-w-[820px] text-sm leading-relaxed text-[#a9b6c8]">
                Зелёная карточка означает: среднее по всем заполненным дням
                недели не ниже {format(data.targets.protein_min)} г.
              </p>
            </div>
          </div>
          <ProteinPeriods
            items={data.weekly}
            target={data.targets.protein_min}
          />
          <details className="mt-4">
            <summary className="w-fit cursor-pointer rounded-xl px-3 py-2 text-sm font-extrabold text-[#87caff] hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]">Посмотреть по месяцам</summary>
            <ProteinPeriods
              items={data.monthly}
              target={data.targets.protein_min}
            />
          </details>
        </section>
        <section className={STATS_CARD_CLASSES}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#69bfff] uppercase">Тренировочная система</p>
              <h2 className="m-0 text-2xl font-black text-white">Объём и мышечный баланс</h2>
              <p className="mt-2 mb-0 max-w-[820px] text-sm leading-relaxed text-[#a9b6c8]">
                Разминочные подходы не раздувают объём. Карта мышц использует
                профиль, сохранённый в момент добавления подхода.
              </p>
            </div>
          </div>
          <TrainingStatistics training={data.training} />
        </section>
        <section className={STATS_CARD_CLASSES}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#69bfff] uppercase">Золотой реестр</p>
              <h2 className="m-0 text-2xl font-black text-white">Что ты ешь и насколько это выгодно</h2>
              <p className="mt-2 mb-0 max-w-[820px] text-sm leading-relaxed text-[#a9b6c8]">
                Индекс учитывает 65% белковой плотности и 35% объёма на 100
                ккал. Это инструмент бюджета, не оценка «полезности» для
                здоровья.
              </p>
            </div>
            <div className="flex gap-1.5 rounded-xl bg-white/[0.05] p-1">
              <button
                className={`min-h-11 cursor-pointer rounded-lg border-0 px-4 text-sm font-extrabold transition-[transform,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${productMode === "popular" ? "bg-[#327ec0] text-white" : "bg-transparent text-[#9dacbf] hover:bg-white/[0.05]"}`}
                onClick={() => setProductMode("popular")}
              >
                Чаще всего
              </button>
              <button
                className={`min-h-11 cursor-pointer rounded-lg border-0 px-4 text-sm font-extrabold transition-[transform,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${productMode === "value" ? "bg-[#327ec0] text-white" : "bg-transparent text-[#9dacbf] hover:bg-white/[0.05]"}`}
                onClick={() => setProductMode("value")}
              >
                По выгодности
              </button>
            </div>
          </div>
          <div className="mt-4 grid w-full min-w-0 overflow-x-auto">
            <div className="grid min-w-[940px] grid-cols-[minmax(300px,2fr)_110px_minmax(170px,1fr)_minmax(160px,1fr)_170px] items-center gap-3 px-3 pb-2 text-xs font-black tracking-[0.07em] text-[#7f8ea3] uppercase">
              <span>Позиция</span>
              <span>Частота</span>
              <span>На 100 г</span>
              <span>Белок / 100 ккал</span>
              <span>Индекс</span>
            </div>
            {products.map((product, index) => (
              <article className="grid min-w-[940px] grid-cols-[minmax(300px,2fr)_110px_minmax(170px,1fr)_minmax(160px,1fr)_170px] items-center gap-3 border-t border-white/[0.07] px-3 py-3" key={product.id}>
                <div className="grid gap-1">
                  <b className="flex items-center gap-2 text-sm text-[#edf3fb]">
                    <em className="min-w-8 text-xs font-normal text-[#65758a] not-italic">#{index + 1}</em>
                    {product.name}
                  </b>
                  <small className="pl-10 text-xs text-[#9eacc0]">
                    {product.category}
                    {!product.active ? " · удалена из реестра" : ""}
                  </small>
                </div>
                <strong className="text-sm text-white tabular-nums">
                  {product.uses}
                  <small className="text-xs font-normal text-[#9eacc0]"> записей</small>
                </strong>
                <span className="text-xs text-[#9eacc0]">
                  {product.kcal_100 == null
                    ? "—"
                    : `${format(product.kcal_100, 1)} ккал · ${format(product.protein_100, 1)} Б`}
                </span>
                <span className="text-xs text-[#9eacc0]">
                  {product.protein_per_100_kcal == null
                    ? "—"
                    : `${format(product.protein_per_100_kcal, 1)} г`}
                </span>
                <div
                  className="grid grid-cols-[42px_1fr] items-center gap-2"
                >
                  <b className={`grid size-10 place-items-center rounded-full text-sm font-black ${product.value_score == null ? "bg-white/[0.08] text-[#9eacc0]" : product.value_score >= 70 ? "bg-[#3ccb85]/18 text-[#72e4aa]" : product.value_score >= 45 ? "bg-[#48a3e8]/18 text-[#8bccff]" : product.value_score >= 25 ? "bg-[#edbe44]/18 text-[#f1cf70]" : "bg-[#eb5760]/16 text-[#ff8d93]"}`}>{product.value_score ?? "—"}</b>
                  <small className="text-xs leading-tight text-[#9eacc0]">{product.value_label}</small>
                </div>
              </article>
            ))}
            {!products.length && (
              <div className={EMPTY_STATE_CLASSES}>
                В выбранном периоде продукты не добавлялись.
              </div>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
