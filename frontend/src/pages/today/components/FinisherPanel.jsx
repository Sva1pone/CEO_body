import React, { useRef, useState } from "react";
import { ArrowRight, Check, Flame, Sparkles, Trash2 } from "lucide-react";

import { format } from "../../../shared/format";
import { CategoryIcon } from "../../../shared/ui";

export function FinisherPanel({ data, onAdd }) {
  const [busy, setBusy] = useState(null);
  const submitting = useRef(false);
  if (data.day.closed_at) return null;
  if (!data.finisher_active) {
    const left = Math.max(
      0,
      Number(data.finisher_threshold) - Number(data.summary.intake),
    );
    return (
      <section className="my-4 rounded-[22px] border border-[rgba(242,189,50,0.32)] bg-[linear-gradient(115deg,rgba(242,189,50,0.13),rgba(17,23,38,0.92)_36%)] px-5 py-4 opacity-85 shadow-[0_18px_42px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-[18px]">
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold tracking-[0.1em] text-[var(--violet)] uppercase">
              Умный финишер
            </p>
            <h2 className="my-1">Подключится после 70% бюджета</h2>
            <p className="m-0 text-[var(--muted)]">
              До активации осталось съесть примерно {format(left)} ккал. Ранние
              подсказки пока не нужны.
            </p>
          </div>
          <span className="grid size-[58px] min-w-[58px] place-items-center rounded-full border border-[rgba(242,189,50,0.34)] text-sm font-black text-[#f2cd67]">
            {format(data.finisher_progress)}%
          </span>
        </div>
      </section>
    );
  }
  if (data.finisher_complete) {
    return (
      <section className="my-4 rounded-[22px] border border-[rgba(69,205,139,0.34)] bg-[linear-gradient(115deg,rgba(47,190,119,0.13),rgba(17,23,38,0.92)_38%)] p-[22px] shadow-[0_18px_42px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-[18px]">
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold tracking-[0.1em] text-[var(--violet)] uppercase">
              Умный финишер
            </p>
            <h2 className="my-1">Добавлять ничего не нужно</h2>
            <p className="m-0 text-[var(--muted)]">
              Белковый минимум закрыт, а целевой калорийный бюджет уже заполнен.
              Можно завершать день.
            </p>
          </div>
          <span className="grid size-[58px] min-w-[58px] place-items-center rounded-full bg-[rgba(65,208,137,0.16)] text-[#75e7ad] shadow-[0_0_22px_rgba(65,208,137,0.14)]">
            <Check size={24} />
          </span>
        </div>
      </section>
    );
  }
  const options = data.finishers || [];
  async function choose(option, index) {
    if (submitting.current) return;
    const foods = option.lines
      .map(
        (line) =>
          `${line.product.name}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`,
      )
      .join("\n");
    const budgetText =
      option.projected_remaining_kcal >= 0
        ? `останется ${format(option.projected_remaining_kcal)} ккал`
        : `перебор цели ${format(-option.projected_remaining_kcal)} ккал`;
    if (
      !window.confirm(
        `Добавить весь набор в «${data.day.current_meal}»?\n\n${foods}\n\nИтог: ${format(option.projected_protein, 1)} г белка, ${budgetText}.`,
      )
    )
      return;
    submitting.current = true;
    setBusy(index);
    try {
      await onAdd(option);
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  }
  return (
    <section className="my-4 rounded-[22px] border border-[rgba(242,189,50,0.32)] bg-[linear-gradient(115deg,rgba(242,189,50,0.13),rgba(17,23,38,0.92)_36%)] p-[22px] shadow-[0_0_0_1px_rgba(242,189,50,0.12),0_18px_42px_rgba(0,0,0,0.2),inset_0_0_35px_rgba(242,189,50,0.06)]">
      <div className="flex items-start justify-between gap-[18px]">
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold tracking-[0.1em] text-[var(--violet)] uppercase">
            Умный финишер · активен
          </p>
          <h2 className="my-1">Чем закрыть день</h2>
          <p className="m-0 text-[var(--muted)]">
            Сначала закрываем белок, затем стараемся не выйти за калорийный
            бюджет.
          </p>
        </div>
        <Sparkles
          className="text-[#f2bd32] drop-shadow-[0_0_10px_rgba(242,189,50,0.4)]"
          size={28}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {options.map((option, index) => (
          <button
            className="grid min-h-[76px] cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2.5 rounded-[15px] border border-white/12 bg-[rgba(4,9,17,0.56)] p-3 text-left text-[var(--ink)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(242,189,50,0.65)] disabled:cursor-wait disabled:opacity-65 disabled:hover:translate-y-0"
            key={index}
            disabled={busy !== null}
            onClick={() => choose(option, index)}
          >
            <span className="grid size-7 place-items-center rounded-[9px] bg-[#f2bd32] font-black text-[#15130d]">
              {String.fromCharCode(65 + index)}
            </span>
            <span className="grid gap-1 text-xs leading-[1.3] font-extrabold">
              {option.lines
                .map(
                  (line) =>
                    `${line.product.name}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`,
                )
                .join(" + ")}
              <small className="text-[9px] font-semibold text-[var(--muted)]">
                {option.protein_met
                  ? "Белок закрыт"
                  : `останется ${format(option.protein_gap_after, 1)} г белка`}
              </small>
            </span>
            <span>
              <b className="text-[#f7d36d]">{format(option.kcal)}</b> ккал
              <br />
              <small className="text-[var(--muted)]">
                {option.projected_remaining_kcal >= 0
                  ? `запас ${format(option.projected_remaining_kcal)}`
                  : `выше на ${format(-option.projected_remaining_kcal)}`}
              </small>
            </span>
            <span
              className={`grid size-[27px] place-items-center rounded-full ${
                option.within_budget
                  ? "bg-[rgba(70,205,139,0.15)] text-[#67dda1]"
                  : "bg-[rgba(236,82,91,0.14)] text-[#ff858b]"
              }`}
            >
              {option.within_budget ? <Check size={16} /> : <Flame size={16} />}
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      {!options.length && (
        <div className="col-span-full rounded-[15px] border border-white/10 bg-black/20 p-5 text-center text-[var(--muted)]">
          Не нашлось разумной комбинации из текущего реестра.
        </div>
      )}
    </section>
  );
}

export function TodayFood({ data, remove, busy }) {
  if (!data.entries.length) return null;
  return (
    <section className="mb-[18px] rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 text-[var(--ink)] shadow-[var(--shadow)]">
      <div className="flex items-end justify-between pb-4">
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold tracking-[0.1em] text-[var(--violet)] uppercase">
            Собрано сегодня
          </p>
          <h2 className="m-0 text-[27px] tracking-[-0.04em]">Весь рацион</h2>
        </div>
        <span className="rounded-[9px] bg-[#2c405c] px-[9px] py-1.5 text-[11px] font-extrabold text-[#c8d1de]">
          {data.entries.length} поз.
        </span>
      </div>
      {data.meals.map((meal) => {
        const items = data.entries.filter((entry) => entry.meal_type === meal);
        if (!items.length) return null;
        return (
          <div
            className="grid grid-cols-[108px_repeat(auto-fill,minmax(230px,1fr))] items-center gap-2 border-t border-[#eeebf3] py-3"
            key={meal}
          >
            <h3 className="m-0 text-[13px] text-[#625d70]">{meal}</h3>
            {items.map((item) => (
              <div
                className="flex min-w-0 items-center gap-[9px] rounded-xl bg-[#22334a] px-2.5 py-[9px]"
                key={item.id}
              >
                <CategoryIcon
                  product={item}
                  size={18}
                  className="size-[34px] rounded-[10px]"
                />
                <span className="min-w-0 flex-1">
                  <b className="block overflow-hidden text-[11px] text-ellipsis whitespace-nowrap">
                    {item.product_name}
                  </b>
                  <small className="mt-0.5 block overflow-hidden text-[9px] text-ellipsis whitespace-nowrap text-[var(--muted)]">
                    {format(item.kcal, 1)} ккал · {format(item.protein, 1)} Б
                  </small>
                </span>
                <button
                  className="grid size-[37px] cursor-pointer place-items-center rounded-[11px] border-0 bg-[#2c405c] text-[#aebbd0] transition-[background-color,color] hover:bg-[#4a2d42] hover:text-[#ff9ab4]"
                  disabled={busy}
                  onClick={() => remove(item.id)}
                  aria-label={`Удалить ${item.product_name}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
