import React, { useRef, useState } from "react";
import { Check, Dumbbell, Flame, Utensils } from "lucide-react";

import { api } from "../../../shared/api";
import { MEAL_META } from "../../../shared/constants";
import { format } from "../../../shared/format";
import { CategoryIcon } from "../../../shared/ui";

export function MealTabs({ data, mutate, onError }) {
  const entryMeals = new Set(data.entries.map((entry) => entry.meal_type));
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  async function choose(meal) {
    if (meal === data.day.current_meal || submitting.current) return;

    submitting.current = true;
    setBusy(true);
    try {
      mutate(
        await api(`/api/day/${data.day.id}/meal`, {
          method: "PATCH",
          body: JSON.stringify({ current_meal: meal }),
        }),
      );
    } catch (reason) {
      onError(reason);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className="meal-tabs mb-[18px] grid grid-cols-4 gap-2.5 rounded-[17px] bg-white/[0.09] p-2"
      role="tablist"
      aria-label="Приёмы пищи"
    >
      {data.meals.map((meal, index) => {
        const Icon = MEAL_META[meal].icon;
        return (
          <button
            key={meal}
            role="tab"
            aria-selected={meal === data.day.current_meal}
            className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border-0 px-3 py-[13px] font-bold transition duration-200 ease-out ${
              meal === data.day.current_meal
                ? "active -translate-y-px bg-[#2c405c] text-white shadow-[0_7px_22px_rgba(0,0,0,0.24)]"
                : "bg-transparent text-[#b9bdca] hover:bg-white/[0.08]"
            } ${entryMeals.has(meal) ? "filled" : ""}`}
            disabled={busy}
            onClick={() => choose(meal)}
          >
            <span
              className={`meal-step grid size-[23px] place-items-center rounded-full text-[11px] ${
                meal === data.day.current_meal
                  ? "bg-[var(--violet)] text-white"
                  : entryMeals.has(meal)
                    ? "bg-[#dff3ed] text-[#2e9c77]"
                    : "bg-white/[0.12]"
              }`}
            >
              {entryMeals.has(meal) ? <Check size={14} /> : index + 1}
            </span>
            <Icon size={18} />
            <span>{meal}</span>
          </button>
        );
      })}
    </div>
  );
}

function polarPoint(angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [50 + 47 * Math.cos(radians), 50 + 47 * Math.sin(radians)];
}

function sectorLabelPoint(start, end) {
  const radians = (((start + end) / 2 - 90) * Math.PI) / 180;
  return [50 + 33 * Math.cos(radians), 50 + 33 * Math.sin(radians)];
}

function sectorPath(start, end) {
  if (end - start >= 359.999) return "M 50 3 A 47 47 0 1 1 49.999 3 Z";
  const [x1, y1] = polarPoint(start);
  const [x2, y2] = polarPoint(end);
  return `M 50 50 L ${x1} ${y1} A 47 47 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

export function rapidDuplicateGroups(entries) {
  const ordered = [...entries].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );
  const groups = [];
  let current = [];
  for (const entry of ordered) {
    const previous = current.at(-1);
    const same =
      previous &&
      previous.product_id === entry.product_id &&
      previous.quantity === entry.quantity &&
      previous.quantity_mode === entry.quantity_mode &&
      previous.meal_type === entry.meal_type;
    const seconds = same
      ? (new Date(entry.created_at) - new Date(previous.created_at)) / 1000
      : Infinity;
    if (same && seconds >= 0 && seconds <= 15) current.push(entry);
    else {
      if (current.length > 1) groups.push(current);
      current = [entry];
    }
  }
  if (current.length > 1) groups.push(current);
  return groups;
}

export function MealPlate({ entries, meal, onEdit }) {
  const mealKcal = entries.reduce((sum, item) => sum + item.kcal, 0);
  const mealProtein = entries.reduce((sum, item) => sum + item.protein, 0);
  const weights = entries.map((item) => Math.max(item.kcal, 90));
  const totalWeight = weights.reduce((sum, item) => sum + item, 0) || 1;
  let angle = 0;
  const sectors = entries.map((entry, index) => {
    const next = angle + (weights[index] / totalWeight) * 360;
    const [labelX, labelY] = sectorLabelPoint(angle, next);
    const sector = {
      entry,
      start: angle,
      end: next,
      path: sectorPath(angle, next),
      labelX,
      labelY,
      index,
    };
    angle = next;
    return sector;
  });
  return (
    <section className="plate-card relative min-h-[675px] min-w-0 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--card)] p-7 text-[var(--ink)] shadow-[var(--shadow)] before:absolute before:top-[-120px] before:right-[-110px] before:size-[330px] before:rounded-full before:bg-[radial-gradient(circle,rgba(109,93,252,0.15),transparent_68%)] before:content-['']">
      <div className="relative z-[2]">
        <p className="mb-1.5 text-[11px] font-extrabold tracking-[0.1em] text-[var(--violet)] uppercase">
          {MEAL_META[meal].eyebrow}
        </p>
        <h2 className="m-0 text-[27px] tracking-[-0.04em]">{meal}</h2>
        <p className="mt-[7px] mb-0 text-[13px] text-[var(--muted)]">
          {entries.length
            ? "Нажми на сектор, чтобы изменить количество, перенести или удалить позицию."
            : "Тарелка пока пустая. Выбери продукт справа."}
        </p>
      </div>
      <div className="relative mx-auto mt-[35px] mb-[29px] aspect-square w-[min(410px,91%)] rounded-full bg-[#ece9f1] p-2 shadow-[0_34px_45px_rgba(45,34,83,0.2),inset_0_5px_12px_rgba(255,255,255,0.8)] before:absolute before:inset-[-9px] before:-z-1 before:rounded-full before:bg-[linear-gradient(135deg,#fff,#ded9ec)] before:shadow-[0_19px_30px_rgba(29,21,60,0.14)] before:content-['']">
        {entries.length ? (
          <svg
            className="block size-full overflow-hidden rounded-full drop-shadow-[0_7px_10px_rgba(31,22,58,0.12)]"
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Тарелка: ${meal}`}
          >
            <defs>
              {sectors
                .filter((item) => item.entry.image_url)
                .map((item) => (
                  <clipPath
                    id={`sector-${item.entry.id}`}
                    key={`clip-${item.entry.id}`}
                  >
                    <path d={item.path} />
                  </clipPath>
                ))}
            </defs>
            {sectors.map((item) => (
              <g
                key={item.entry.id}
                className="group cursor-pointer outline-none"
                onClick={() => onEdit(item.entry)}
                onKeyDown={(event) =>
                  event.key === "Enter" && onEdit(item.entry)
                }
                tabIndex="0"
                role="button"
                aria-label={`Изменить ${item.entry.product_name}`}
              >
                <title>
                  {item.entry.product_name} · {format(item.entry.kcal, 1)} ккал
                </title>
                <path
                  className="origin-center stroke-white/90 stroke-[0.65px] transition duration-200 group-hover:scale-[1.025] group-hover:brightness-[1.18] group-hover:stroke-[1px] group-focus:scale-[1.025] group-focus:brightness-[1.18] group-focus:stroke-[1px]"
                  d={item.path}
                  fill={item.entry.category_color || "#6d5dfc"}
                />
                {item.entry.image_url && (
                  <image
                    href={item.entry.image_url}
                    x="3"
                    y="3"
                    width="94"
                    height="94"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#sector-${item.entry.id})`}
                  />
                )}
                <path
                  d={item.path}
                  fill={
                    item.entry.image_url
                      ? "rgba(8, 12, 24, .15)"
                      : "rgba(255,255,255,.08)"
                  }
                />
                {item.end - item.start >= 19 && (
                  <g className="pointer-events-none [paint-order:stroke] [stroke-linejoin:round] [stroke-width:1.2px] [stroke:rgba(7,10,18,0.72)] [text-anchor:middle]">
                    <text
                      className="fill-white text-[3px] font-black"
                      x={item.labelX}
                      y={item.labelY - 1}
                    >
                      {item.entry.product_name.length > 14
                        ? `${item.entry.product_name.slice(0, 12)}…`
                        : item.entry.product_name}
                    </text>
                    <text
                      className="fill-[#eef3fb] text-[2.7px] font-bold"
                      x={item.labelX}
                      y={item.labelY + 4.2}
                    >
                      {format(item.entry.kcal)} ккал
                    </text>
                  </g>
                )}
              </g>
            ))}
            <circle
              className="pointer-events-none fill-[rgba(11,14,26,0.9)] stroke-white/85 stroke-[1px]"
              cx="50"
              cy="50"
              r="20"
            />
            <text
              className="pointer-events-none fill-white text-[9px] font-extrabold [text-anchor:middle]"
              x="50"
              y="47"
            >
              {format(mealKcal)}
            </text>
            <text
              className="pointer-events-none fill-white/70 text-[3.2px] [text-anchor:middle]"
              x="50"
              y="54"
            >
              ккал
            </text>
            <text
              className="pointer-events-none fill-white/70 text-[2.6px] [text-anchor:middle]"
              x="50"
              y="61"
            >
              нажми сектор
            </text>
          </svg>
        ) : (
          <div className="absolute inset-0 grid place-content-center place-items-center gap-2.5 text-[#8e889e]">
            <Utensils className="text-[#aaa2c2]" size={38} />
            <b>Добавь первую позицию</b>
          </div>
        )}
      </div>
      <div className="relative z-[2] flex justify-center gap-3">
        <span className="flex items-center gap-1.5 rounded-[11px] bg-[#2c405c] px-3 py-2.5 text-xs font-bold text-[#d5deea]">
          <Flame size={17} /> {format(mealKcal, 1)} ккал
        </span>
        <span className="flex items-center gap-1.5 rounded-[11px] bg-[#2c405c] px-3 py-2.5 text-xs font-bold text-[#d5deea]">
          <Dumbbell size={17} /> {format(mealProtein, 1)} г белка
        </span>
      </div>
    </section>
  );
}
