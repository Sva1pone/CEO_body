import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, FlaskConical, Scale } from "lucide-react";

import { api } from "../../shared/api";
import { format } from "../../shared/format";
import { ErrorState, Loading, Shell } from "../../shared/ui";
import {
  DATE_RANGE_STORAGE_KEYS,
  isValidDateRange,
  usePersistedDateRange,
} from "../../shared/usePersistedDateRange";

const CARD_CLASSES =
  "min-w-0 rounded-[22px] border border-[#65a5e2]/20 bg-[linear-gradient(145deg,rgba(20,29,45,0.97),rgba(8,13,23,0.97))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.2)]";
const FIELD_CLASSES =
  "min-h-12 rounded-xl border border-white/14 bg-[#171f2e] px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-[#71b9ff]/70 focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";

function createDefaultWeightTrendRange() {
  const today = new Date().toISOString().slice(0, 10);
  const initialStart = new Date();
  initialStart.setDate(initialStart.getDate() - 179);
  return { start: initialStart.toISOString().slice(0, 10), end: today };
}

function signed(value, digits = 2) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${format(number, digits)}`;
}

function WeightChart({ points }) {
  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const width = 1000;
    const height = 380;
    const padding = { left: 60, right: 34, top: 28, bottom: 92 };
    const values = points.flatMap((point) =>
      point.expected_weight === null
        ? [point.trend_weight]
        : [point.trend_weight, point.expected_weight],
    );
    const min = Math.min(...values) - 0.2;
    const max = Math.max(...values) + 0.2;
    const range = Math.max(0.4, max - min);
    const x = (index) =>
      padding.left +
      (index / (points.length - 1)) * (width - padding.left - padding.right);
    const y = (value) =>
      padding.top +
      ((max - value) / range) * (height - padding.top - padding.bottom);
    const pathFor = (key) =>
      points
        .map(
          (point, index) => `${index ? "L" : "M"}${x(index)} ${y(point[key])}`,
        )
        .join(" ");
    const expectedSegments = [];
    let currentSegment = [];
    for (const [index, point] of points.entries()) {
      if (point.expected_weight === null) {
        if (currentSegment.length) expectedSegments.push(currentSegment);
        currentSegment = [];
      } else {
        currentSegment.push(index);
      }
    }
    if (currentSegment.length) expectedSegments.push(currentSegment);
    const expectedSegmentPath = (segment) =>
      segment
        .map(
          (index, position) =>
            `${position ? "L" : "M"}${x(index)} ${y(points[index].expected_weight)}`,
        )
        .join(" ");
    return {
      width,
      height,
      padding,
      min,
      max,
      x,
      y,
      pathFor,
      expectedSegments,
      expectedSegmentPath,
    };
  }, [points]);

  if (!chart)
    return (
      <p className="m-0 py-10 text-center text-sm text-[#a7b3c5]">
        Для кривых нужны хотя бы два измерения веса.
      </p>
    );

  return (
    <div className="overflow-x-auto pt-4">
      <svg
        className="block h-auto min-w-[760px] w-full"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Сравнение сглаженного и расчётного веса"
      >
        {[chart.min, (chart.min + chart.max) / 2, chart.max].map((value) => (
          <g key={value}>
            <line
              x1={chart.padding.left}
              x2={chart.width - chart.padding.right}
              y1={chart.y(value)}
              y2={chart.y(value)}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="5 8"
            />
            <text x="8" y={chart.y(value) + 4} fill="#9aabc0" fontSize="12">
              {format(value, 1)} кг
            </text>
          </g>
        ))}
        {chart.expectedSegments.map((segment) => (
          <path
            key={segment.join("-")}
            d={chart.expectedSegmentPath(segment)}
            fill="none"
            stroke="#9f86ff"
            strokeDasharray="8 7"
            strokeLinecap="round"
            strokeWidth="3"
          />
        ))}
        <path
          d={chart.pathFor("trend_weight")}
          fill="none"
          stroke="#58c4ff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle
              cx={chart.x(index)}
              cy={chart.y(point.weight)}
              r="4"
              fill="#dce8f5"
              opacity="0.62"
            >
              <title>{`${point.date}: факт ${format(point.weight, 2)} кг`}</title>
            </circle>
            <circle
              cx={chart.x(index)}
              cy={chart.y(point.trend_weight)}
              r="4.5"
              fill="#58c4ff"
            >
              <title>{`${point.date}: сглаженный вес ${format(point.trend_weight, 2)} кг`}</title>
            </circle>
            {point.expected_weight !== null && (
              <circle
                cx={chart.x(index)}
                cy={chart.y(point.expected_weight)}
                r="4.5"
                fill="#9f86ff"
              >
                <title>{`${point.date}: планируемый вес ${format(point.expected_weight, 2)} кг`}</title>
              </circle>
            )}
          </g>
        ))}
        {points.map((point, index) => (
          <text
            key={`${point.date}-${index}`}
            transform={`translate(${chart.x(index)} ${chart.height - 22}) rotate(-42)`}
            textAnchor="end"
            fill="#a8b7cb"
            fontSize="12"
          >
            {point.date.split("-").reverse().join(".")}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-5 text-sm text-[#c4cede]">
        <span className="inline-flex items-center gap-2">
          <i className="block size-2.5 rounded-full bg-[#58c4ff]" />
          сглаженный вес
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="block h-0.5 w-4 bg-[#9f86ff]" />
          энергетический эквивалент
        </span>
      </div>
    </div>
  );
}

export default function WeightTrendPage() {
  const { range, setRange, saveRange } = usePersistedDateRange(
    DATE_RANGE_STORAGE_KEYS.weightTrend,
    createDefaultWeightTrendRange,
  );
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [requestedRange, setRequestedRange] = useState(range);
  const latestRequest = useRef(0);

  const load = async (loadedRange = requestedRange) => {
    if (!isValidDateRange(loadedRange)) return;
    const requestId = ++latestRequest.current;
    setError("");
    try {
      const result = await api(
        `/api/weight-trend?start=${loadedRange.start}&end=${loadedRange.end}`,
      );
      if (requestId === latestRequest.current) {
        setData(result);
        saveRange(loadedRange);
      }
    } catch (reason) {
      if (requestId === latestRequest.current) setError(reason.message);
    }
  };

  useEffect(() => {
    load(requestedRange);
  }, [requestedRange.start, requestedRange.end]);

  if (error && !data)
    return (
      <Shell active="weight-trend" cinematic>
        <ErrorState error={error} retry={() => load(requestedRange)} />
      </Shell>
    );
  if (!data)
    return (
      <Shell active="weight-trend" cinematic>
        <Loading />
      </Shell>
    );

  const { comparison, points } = data;
  const tone = {
    aligned: "border-[#62dc9e]/35 bg-[#62dc9e]/10 text-[#c9ffe1]",
    masked: "border-[#f0c659]/35 bg-[#f0c659]/10 text-[#fff0b1]",
    diverged: "border-[#ff7699]/35 bg-[#ff7699]/10 text-[#ffc2d1]",
    insufficient: "border-[#71b9ff]/30 bg-[#71b9ff]/10 text-[#c8e9ff]",
  }[comparison.status];

  return (
    <Shell active="weight-trend" cinematic>
      <div className="grid min-w-0 gap-5 text-[#f4f7fc]">
        <header className="rounded-[26px] border border-[#71b9ff]/20 bg-[radial-gradient(circle_at_85%_15%,rgba(97,173,255,0.17),transparent_26rem),linear-gradient(145deg,rgba(25,35,55,0.98),rgba(9,14,24,0.98))] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.26)]">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.12em] text-[#84c9ff] uppercase">
            <FlaskConical size={16} />
            тестовый экран · только чтение
          </span>
          <h1 className="mt-4 mb-3 text-5xl font-black tracking-[-0.05em]">
            Вес и <span className="text-[#70c8ff]">энергобаланс</span>
          </h1>
          <p className="m-0 max-w-[78ch] text-base leading-relaxed text-[#b7c4d5]">
            Сравнивает сглаженный вес с энергетическим эквивалентом закрытых
            дней. Ничего не сохраняет и не меняет.
          </p>
        </header>
        <form
          className={`${CARD_CLASSES} flex flex-wrap items-end gap-4`}
          onSubmit={(event) => {
            event.preventDefault();
            if (isValidDateRange(range)) setRequestedRange(range);
          }}
        >
          <label className="grid gap-2 text-sm font-bold text-[#c9d5e4]">
            От
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
          <label className="grid gap-2 text-sm font-bold text-[#c9d5e4]">
            До
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
          <button className="min-h-12 cursor-pointer rounded-xl border border-[#71b9ff]/50 bg-[#42a9ff]/16 px-5 text-sm font-extrabold text-[#dff3ff] transition hover:bg-[#42a9ff]/25">
            Пересчитать
          </button>
          <span className="ml-auto text-sm text-[#9eafc4]">
            {points.length} измерений · {data.kcal_per_kg_energy_equivalent}{" "}
            ккал/кг
          </span>
        </form>
        {error && (
          <p className="m-0 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-4 py-3 text-sm text-[#ffc0d0]">
            {error}
          </p>
        )}
        <section className={`${CARD_CLASSES} grid gap-3`}>
          <h2 className="m-0 flex items-center gap-2 text-2xl font-black">
            <Scale className="text-[#70c8ff]" />
            Две кривые
          </h2>
          <WeightChart points={points} />
        </section>
        <section className={`${CARD_CLASSES} grid gap-4`}>
          <div>
            <h2 className="m-0 text-2xl font-black">Детали расчёта</h2>
            <p className="mt-2 mb-0 text-sm text-[#a9b8ca]">
              Каждая строка — отдельный замер. Прогноз появляется только после
              первого закрытого дня, вошедшего в расчёт.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead className="text-[#9eb0c6]">
                <tr>
                  <th className="border-b border-white/10 px-3 py-3">Дата</th>
                  <th className="border-b border-white/10 px-3 py-3">Весы</th>
                  <th className="border-b border-white/10 px-3 py-3">
                    Сглаженный
                  </th>
                  <th className="border-b border-white/10 px-3 py-3">
                    Планируемый
                  </th>
                  <th className="border-b border-white/10 px-3 py-3">
                    Закрыто дней
                  </th>
                  <th className="border-b border-white/10 px-3 py-3">
                    Накопленная дельта
                  </th>
                </tr>
              </thead>
              <tbody>
                {points.map((point, index) => (
                  <tr key={`${point.date}-${index}`} className="text-[#dce6f3]">
                    <td className="border-b border-white/[0.06] px-3 py-3 font-semibold">
                      {point.date.split("-").reverse().join(".")}
                    </td>
                    <td className="border-b border-white/[0.06] px-3 py-3">
                      {format(point.weight, 2)} кг
                    </td>
                    <td className="border-b border-white/[0.06] px-3 py-3 text-[#69c8ff]">
                      {format(point.trend_weight, 2)} кг
                    </td>
                    <td className="border-b border-white/[0.06] px-3 py-3 text-[#b39bff]">
                      {point.expected_weight === null
                        ? "нет данных"
                        : `${format(point.expected_weight, 2)} кг`}
                    </td>
                    <td className="border-b border-white/[0.06] px-3 py-3">
                      {point.closed_days_count}
                    </td>
                    <td className="border-b border-white/[0.06] px-3 py-3">
                      {signed(point.energy_delta, 0)} ккал
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="grid grid-cols-3 gap-4">
          <div className={CARD_CLASSES}>
            <span className="text-sm text-[#9eafc4]">Сглаженное изменение</span>
            <b className="mt-2 block text-3xl text-[#58c4ff]">
              {comparison.observed_change === undefined
                ? "—"
                : `${signed(comparison.observed_change)} кг`}
            </b>
          </div>
          <div className={CARD_CLASSES}>
            <span className="text-sm text-[#9eafc4]">Расчётное изменение</span>
            <b className="mt-2 block text-3xl text-[#a995ff]">
              {comparison.expected_change === undefined
                ? "—"
                : `${signed(comparison.expected_change)} кг`}
            </b>
          </div>
          <div className={CARD_CLASSES}>
            <span className="text-sm text-[#9eafc4]">Расхождение</span>
            <b className="mt-2 block text-3xl text-white">
              {comparison.residual === undefined
                ? "—"
                : `${signed(comparison.residual)} кг`}
            </b>
          </div>
        </section>
        <section className={`${CARD_CLASSES} border ${tone}`}>
          <h2 className="m-0 flex items-center gap-2 text-xl font-black">
            <Activity size={22} />
            Вывод
          </h2>
          <p className="mt-3 mb-0 max-w-[95ch] text-base leading-relaxed">
            {comparison.message}
          </p>
        </section>
      </div>
    </Shell>
  );
}
