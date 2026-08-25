import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  Dumbbell,
  Flame,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import { api } from "../../shared/api";
import { deficitStatus } from "../../shared/deficitStatus";
import { format } from "../../shared/format";
import {
  CinematicHeroArt,
  ErrorState,
  InfoTip,
  Loading,
  MetricCard,
  Shell,
} from "../../shared/ui";
import { DaySetup, TrainingStarter } from "./components/DayPlanning";
import { DayDetails, DateNavigator, SleepPanel } from "./components/DayMetrics";
import { TodayFood } from "./components/FinisherPanel";
import {
  MealPlate,
  MealTabs,
  rapidDuplicateGroups,
} from "./components/MealPlate";
import {
  EntryEditor,
  ProductFinder,
  ProductPicker,
} from "./components/ProductBrowser";

const HERO_ART_FILTER = {
  green: "",
  yellow: "",
  red: "",
  blue: "",
};

export default function TodayPage() {
  const date =
    new URLSearchParams(location.search).get("date") ||
    new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [toast, setToast] = useState("");
  const [deleteDayOpen, setDeleteDayOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [dayStatusBusy, setDayStatusBusy] = useState(false);
  const [mealBusy, setMealBusy] = useState(false);
  const [foodActionBusy, setFoodActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const dayStatusSubmitting = useRef(false);
  const mealSubmitting = useRef(false);
  const foodActionSubmitting = useRef(false);
  const loadRequest = useRef(0);
  const load = () => {
    const requestId = loadRequest.current + 1;
    loadRequest.current = requestId;
    setError("");
    return api(`/api/day?date=${encodeURIComponent(date)}`)
      .then((payload) => {
        if (requestId === loadRequest.current) setData(payload);
      })
      .catch((reason) => {
        if (requestId === loadRequest.current) setError(reason.message);
      });
  };
  useEffect(() => {
    load();
  }, [date]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!deleteDayOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !deleteBusy) setDeleteDayOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteBusy, deleteDayOpen]);
  if (error === "Сначала создай стратегию питания.")
    return (
      <Shell active="today" cinematic>
        <section className="grid min-h-[70vh] place-content-center justify-items-center gap-4 px-6 text-center">
          <Target size={34} aria-hidden="true" />
          <h1 className="m-0 text-3xl font-black text-white">
            Сначала настрой стратегию
          </h1>
          <p className="m-0 max-w-xl text-[#b6c3d5]">
            Укажи название фазы, базовый TDEE, белковый коридор и целевую
            дельту. После этого приложение сможет создать первый день.
          </p>
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#5a8ef1]/65 bg-[#5a8ef1]/18 px-5 font-black text-[#c8e5ff] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
            href="/settings"
          >
            Настроить стратегию
          </a>
        </section>
      </Shell>
    );
  if (error)
    return (
      <Shell active="today" cinematic>
        <ErrorState error={error} retry={load} />
      </Shell>
    );
  if (!data)
    return (
      <Shell active="today" cinematic>
        <Loading />
      </Shell>
    );
  if (!data.day.setup_done)
    return (
      <Shell active="today" cinematic>
        <DaySetup data={data} mutate={setData} />
      </Shell>
    );
  const meal = data.day.current_meal;
  const mealEntries = data.entries.filter((entry) => entry.meal_type === meal);
  const currentIndex = data.meals.indexOf(meal);
  const nextMeal = data.meals[currentIndex + 1];
  const budgetPercent = Math.min(
    100,
    Math.max(0, (data.summary.intake / Math.max(data.summary.target, 1)) * 100),
  );
  const status = deficitStatus(data);
  const duplicateGroups = rapidDuplicateGroups(data.entries);
  async function runFoodAction(action, rethrow = false) {
    if (foodActionSubmitting.current) {
      const reason = new Error("Другое изменение рациона ещё сохраняется.");
      setActionError(reason.message);
      if (rethrow) throw reason;
      return null;
    }

    foodActionSubmitting.current = true;
    setFoodActionBusy(true);
    setActionError("");
    try {
      return await action();
    } catch (reason) {
      setActionError(reason.message);
      if (rethrow) throw reason;
      return null;
    } finally {
      foodActionSubmitting.current = false;
      setFoodActionBusy(false);
    }
  }
  async function addProduct(product, quantity, mode, requestToken) {
    const next = await runFoodAction(
      () => api(`/api/day/${data.day.id}/food`, {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          quantity,
          quantity_mode: mode,
          meal_type: meal,
          request_token: requestToken,
        }),
      }),
      true,
    );
    if (!next) return;
    setData(next);
    setToast(`${product.name} добавлен`);
  }
  async function remove(entryId, rethrow = false) {
    const next = await runFoodAction(
      () => api(`/api/food/${entryId}`, { method: "DELETE" }),
      rethrow,
    );
    if (!next) return;
    setData(next);
    setToast("Позиция удалена");
  }
  async function updateEntry(entry, quantity, mode, nextMeal) {
    const next = await runFoodAction(
      () => api(`/api/food/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity,
          quantity_mode: mode,
          meal_type: nextMeal,
        }),
      }),
      true,
    );
    setData(next);
    setToast("Позиция обновлена");
  }
  async function cleanDuplicateGroup(group) {
    const removeCount = group.length - 1;
    if (
      !confirm(
        `Похоже, «${group[0].product_name}» записался ${group.length} раз подряд. Оставить одну запись и удалить ещё ${removeCount}?`,
      )
    )
      return;
    const result = await runFoodAction(async () => {
      let next = data;
      for (const entry of group.slice(1))
        next = await api(`/api/food/${entry.id}`, { method: "DELETE" });
      return next;
    });
    if (!result) return;
    setData(result);
    setToast(`Удалено случайных повторов: ${removeCount}`);
  }
  async function moveNext() {
    if (!nextMeal || mealSubmitting.current) return;

    mealSubmitting.current = true;
    setMealBusy(true);
    setActionError("");
    try {
      setData(
        await api(`/api/day/${data.day.id}/meal`, {
          method: "PATCH",
          body: JSON.stringify({ current_meal: nextMeal }),
        }),
      );
      scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setActionError(reason.message);
    } finally {
      mealSubmitting.current = false;
      setMealBusy(false);
    }
  }
  async function deleteDay(event) {
    event.preventDefault();
    setDeleteError("");
    setDeleteBusy(true);
    try {
      await api(`/api/day/${data.day.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm_date: deleteConfirm }),
      });
      const today = new Date().toISOString().slice(0, 10);
      const previous = new Date(`${date}T12:00:00`);
      previous.setDate(previous.getDate() - 1);
      const target = date > today ? today : previous.toISOString().slice(0, 10);
      location.assign(`/?date=${target}`);
    } catch (reason) {
      setDeleteError(reason.message);
      setDeleteBusy(false);
    }
  }
  async function toggleDayStatus() {
    if (dayStatusSubmitting.current) return;

    dayStatusSubmitting.current = true;
    setDayStatusBusy(true);
    setActionError("");

    try {
      const endpoint = data.day.closed_at ? "reopen" : "close";
      setData(
        await api(`/api/day/${data.day.id}/${endpoint}`, {
          method: "POST",
        }),
      );
      setToast(
        data.day.closed_at
          ? "День снова открыт"
          : "День закрыт и учтён в глобальном счёте",
      );
    } catch (reason) {
      setActionError(reason.message);
    } finally {
      dayStatusSubmitting.current = false;
      setDayStatusBusy(false);
    }
  }
  return (
    <Shell active="today" cinematic>
      {toast && (
        <div
          className="fixed top-6 right-6 z-150 flex animate-[toastIn_300ms_ease_both] items-center gap-2 rounded-[13px] bg-[#242033] px-4 py-3 text-xs font-bold text-white shadow-[0_15px_40px_rgba(28,22,49,0.3)] motion-reduce:animate-none [&_svg]:text-[#86e0c0]"
          role="status"
          aria-live="polite"
        >
          <Check size={18} /> {toast}
        </div>
      )}
      {actionError && (
        <div
          className="fixed top-6 right-6 z-150 flex max-w-md items-center gap-2 rounded-[13px] border border-[#ff7699]/35 bg-[#4d1e2c] px-4 py-3 text-sm font-bold text-[#ffd2df] shadow-[0_15px_40px_rgba(58,11,27,0.35)]"
          role="alert"
        >
          {actionError}
        </div>
      )}
      <DateNavigator date={date} />
      <header
        className="cinematic-hero mb-[22px] flex min-h-[285px] items-center justify-between gap-10 px-[34px] py-[31px]"
        style={{
          "--state": status.color,
          "--hero-accent": status.color,
        }}
      >
        <CinematicHeroArt
          className={HERO_ART_FILTER[status.key] ?? HERO_ART_FILTER.blue}
        />
        <div className="relative z-[2] max-w-[670px]">
          <span className="inline-flex w-max items-center gap-[7px] rounded-full border border-[color-mix(in_srgb,var(--state)_58%,transparent)] bg-[color-mix(in_srgb,var(--state)_18%,#111827)] px-[11px] py-[7px] text-xs font-extrabold tracking-[0.05em] text-[#f4f8ff] uppercase">
            <Flame size={15} />
            {data.day.phase}
          </span>
          <p className="mt-5 mb-[-4px] flex items-center gap-2 text-[11px] font-black tracking-[0.16em] text-[var(--state)] uppercase">
            <span className="inline-block size-2 animate-[beacon_1.6s_ease-in-out_infinite] rounded-full bg-[var(--state)] shadow-[0_0_13px_var(--state)]" />
            {status.title}
          </p>
          <h1 className="my-[13px] max-w-[760px] text-[clamp(36px,4.2vw,60px)] leading-[1.02] font-extrabold tracking-[-0.055em] text-white">
            Соберём день{" "}
            <span className="text-[var(--state)] [text-shadow:0_0_23px_color-mix(in_srgb,var(--state)_60%,transparent)]">
              без лишних решений
            </span>
          </h1>
          <p className="m-0 flex items-center gap-2 text-[#bdc1cf]">
            <CalendarDays size={17} /> {data.day.log_date} · {data.day.day_type}
          </p>
          <p className="mt-[13px] flex max-w-[470px] items-center gap-2 text-xs leading-[1.6] text-[#bdc1cf]">
            {status.caption}
          </p>
        </div>
        <div
          className="relative z-[3] grid size-[154px] shrink-0 animate-[breathe_3.2s_ease-in-out_infinite] rounded-full bg-[conic-gradient(var(--state)_var(--progress),rgba(255,255,255,0.18)_0)] p-2.5 shadow-[0_15px_50px_color-mix(in_srgb,var(--state)_32%,transparent)]"
          style={{ "--progress": `${budgetPercent * 3.6}deg` }}
        >
          <div className="grid h-full place-content-center rounded-full bg-[#0a0f19]/[0.92] text-center text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
            <small className="text-[11px] text-[#b9bfcc]">осталось</small>
            <strong className="text-[30px] leading-none tracking-[-0.06em]">
              {format(data.summary.remaining_kcal)}
            </strong>
            <span className="text-[11px] text-[#b9bfcc]">ккал</span>
          </div>
        </div>
      </header>
      <MealTabs
        data={data}
        mutate={setData}
        onError={(reason) => setActionError(reason.message)}
      />
      <section className="mb-[18px] grid grid-cols-[1.25fr_1fr_1fr] gap-[13px]">
        <MetricCard
          appearance="dashboard"
          large
          icon={Target}
          label="Бюджет дня"
          value={format(data.summary.remaining_kcal)}
          suffix={`из ${format(data.summary.target)} ккал`}
          hint="Сколько можно съесть, чтобы остаться у целевого дефицита."
        />
        <MetricCard
          appearance="dashboard"
          icon={Dumbbell}
          label="Белковый баланс"
          value={`${format(data.summary.protein, 1)} / ${format(data.day.protein_min ?? data.settings.protein_min)}`}
          suffix={`осталось ${format(data.summary.remaining_protein, 1)} г`}
          tone="pink"
          hint="Минимум белка, сохранённый именно для этого дня версией стратегии."
        />
        <MetricCard
          appearance="dashboard"
          icon={Activity}
          label="Баланс сейчас"
          value={`${data.summary.delta > 0 ? "+" : ""}${format(data.summary.delta)}`}
          suffix={
            data.summary.delta <= 0
              ? `дефицит ${format(data.summary.deficit)} ккал`
              : `профицит ${format(data.summary.delta)} ккал`
          }
          tone="cyan"
          hint="Съеденное минус расчётный расход. Минус — дефицит, плюс — профицит. Это не остаток дневного бюджета."
        />
      </section>
      {duplicateGroups.map((group) => (
        <div
          className="mb-[17px] flex items-center justify-between gap-3.5 rounded-[14px] border border-[#ffae40]/35 bg-[linear-gradient(90deg,rgba(255,146,42,0.15),rgba(255,255,255,0.04))] px-3.5 py-3 text-xs text-[#f3d4a4] shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
          key={group[0].id}
          role="alert"
        >
          <span className="flex items-center gap-[7px]">
            <Zap size={18} />
            <b>Возможный повтор:</b> «{group[0].product_name}» добавлен{" "}
            {group.length} раз за несколько секунд.
          </span>
          <button
            className="min-h-10 shrink-0 cursor-pointer rounded-[10px] border border-[#ffb74f]/45 bg-[#ffa434]/15 px-3 text-xs font-extrabold text-[#ffe3b4] transition-[transform,background-color] hover:bg-[#ffa434]/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb04c] active:scale-[0.96]"
            onClick={() => cleanDuplicateGroup(group)}
          >
            Проверить и оставить одну
          </button>
        </div>
      ))}
      <section className="mb-[18px] grid min-w-0 grid-cols-[minmax(380px,0.92fr)_minmax(440px,1.08fr)] items-stretch gap-[18px] max-[1100px]:grid-cols-[minmax(0,1fr)]">
        <MealPlate entries={mealEntries} meal={meal} onEdit={setEditingEntry} />
        <ProductFinder
          data={data}
          onPick={setPicker}
          onProductsChanged={load}
          notify={setToast}
        />
      </section>
      {/*<div className="flex items-center justify-end gap-[18px] px-[3px] pt-[18px] pb-[30px]">*/}
      {/*  <span className="text-xs text-[#b6bac6]">*/}
      {/*    {mealEntries.length*/}
      {/*      ? `${meal}: ${mealEntries.length} поз.`*/}
      {/*      : "Можно оставить приём пустым и перейти дальше"}*/}
      {/*  </span>*/}
      {/*  {nextMeal && (*/}
      {/*    <button*/}
      {/*      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[var(--violet)] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-[17px] font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96]"*/}
      {/*      disabled={mealBusy}*/}
      {/*      onClick={moveNext}*/}
      {/*    >*/}
      {/*      {mealBusy*/}
      {/*        ? "Сохраняю…"*/}
      {/*        : `${meal} готов → ${nextMeal.toLowerCase()}`} <ArrowRight size={18} />*/}
      {/*    </button>*/}
      {/*  )}*/}
      {/*</div>*/}
      <TodayFood data={data} remove={remove} busy={foodActionBusy} />
      <section className="grid gap-3">
        <TrainingStarter data={data} />
        <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] items-stretch gap-3">
          <DayDetails data={data} mutate={setData} notify={setToast} />
          <SleepPanel data={data} mutate={setData} notify={setToast} />
        </div>
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#111827]/95 px-5 py-[17px] text-[#f6f8fc] shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
          <span className="flex items-center gap-[9px] text-[13px] font-semibold text-[#b8c0cf]">
            <Sparkles size={18} /> Глобальный счёт{" "}
            {data.day.closed_at ? "" : "с учётом сегодня"}
          </span>
          <b className="ml-auto text-xl font-black tabular-nums text-white">
            {(data.day.closed_at
              ? data.global_balance
              : data.projected_global_balance) > 0
              ? "+"
              : ""}
            {format(
              data.day.closed_at
                ? data.global_balance
                : data.projected_global_balance,
            )}{" "}
            ккал
          </b>
          <InfoTip
            text={
              data.day.closed_at
                ? "В счёт вошли все закрытые дни."
                : "Предварительное значение: закрытые дни плюс текущий баланс. После закрытия дня станет официальным."
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-[3px] pt-4 text-[13px] text-[#aeb3c0]">
          <span className="max-w-[75ch] text-pretty">
            {data.day.closed_at
              ? "День закрыт: глобальный счёт зафиксирован."
              : "Закрой день, когда рацион и активность окончательно внесены."}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <button
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[#f2c6d2] bg-[#fff4f6] px-4 text-sm font-extrabold text-[#b92f54] transition-[transform,background-color,border-color] hover:border-[#e89aaf] hover:bg-[#ffe8ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7699] active:scale-[0.96]"
              onClick={() => {
                setDeleteConfirm("");
                setDeleteError("");
                setDeleteDayOpen(true);
              }}
            >
              <Trash2 size={16} /> Удалить день
            </button>
            <button
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[13px] px-4 text-sm font-extrabold transition-[transform,background-color,border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.96] ${
                data.day.closed_at
                  ? "border border-white/15 bg-white/[0.07] text-[#eef2f8] hover:border-[#71b9ff]/60 hover:bg-[#42a9ff]/15 focus-visible:outline-[#71b9ff]"
                  : "border border-[var(--violet)] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-[#9b91ff]"
              }`}
              disabled={dayStatusBusy}
              onClick={toggleDayStatus}
            >
              {dayStatusBusy
                ? "Сохраняю…"
                : data.day.closed_at
                  ? "Открыть для правок"
                  : "Закрыть день"}
            </button>
          </div>
        </div>
      </section>
      <ProductPicker
        key={`${meal}-${picker?.id ?? "closed"}`}
        product={picker}
        meal={meal}
        onClose={() => setPicker(null)}
        onAdded={addProduct}
      />
      {editingEntry && (
        <EntryEditor
          entry={editingEntry}
          meals={data.meals}
          onClose={() => setEditingEntry(null)}
          onSaved={updateEntry}
          onDeleted={(entryId) => remove(entryId, true)}
        />
      )}
      {deleteDayOpen && (
        <div
          className="fixed inset-0 z-100 grid place-items-center bg-[#02060c]/80 p-6 backdrop-blur-xl animate-[fadeIn_180ms_ease_both] motion-reduce:animate-none"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            !deleteBusy &&
            setDeleteDayOpen(false)
          }
        >
          <form
            className="relative max-h-[calc(100vh-48px)] w-full max-w-[570px] overflow-y-auto rounded-3xl border border-[#ff7699]/20 bg-[linear-gradient(145deg,rgba(29,27,43,0.99),rgba(12,14,23,0.99))] p-7 text-white shadow-[0_38px_100px_rgba(0,0,0,0.62)] animate-[modalIn_280ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-day-title"
            onSubmit={deleteDay}
          >
            <button
              type="button"
              className="absolute top-5 right-5 z-10 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color,border-color] hover:border-[#ff7699]/45 hover:bg-[#ff7699]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7699] active:scale-[0.96] disabled:cursor-default disabled:opacity-45"
              disabled={deleteBusy}
              onClick={() => setDeleteDayOpen(false)}
              aria-label="Закрыть удаление дня"
            >
              <X />
            </button>
            <span className="mb-5 grid size-14 place-items-center rounded-2xl border border-[#ff7699]/25 bg-[#ff7699]/12 text-[#ff8baa] shadow-[0_12px_30px_rgba(255,77,125,0.12)]">
              <Trash2 size={25} />
            </span>
            <p className="mb-2 text-xs font-extrabold tracking-[0.1em] text-[#ff8baa] uppercase">
              Безопасное удаление
            </p>
            <h2
              className="mt-0 mb-3 pr-14 text-3xl leading-tight font-black tracking-[-0.04em] text-balance"
              id="delete-day-title"
            >
              Удалить день {data.day.log_date}?
            </h2>
            <p className="my-0 text-sm leading-relaxed text-[#b6bfcd] text-pretty">
              Рацион, активность, сон и тренировки этого дня исчезнут из
              статистики. Перед удалением приложение автоматически создаст
              резервную копию всей базы.
            </p>
            <label className="mt-5 grid gap-2 text-sm font-extrabold text-[#d1d7e1]">
              Для подтверждения введи <b>{data.day.log_date}</b>
              <input
                className="min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-base font-bold tabular-nums text-white outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#707b8c] focus:border-[#ff7699]/65 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(255,118,153,0.1)]"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="ГГГГ-ММ-ДД"
                autoFocus
              />
            </label>
            {deleteError && (
              <p className="my-3 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-3 py-2.5 text-sm leading-relaxed text-[#ffb5c8]">
                {deleteError}
              </p>
            )}
            <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-2.5">
              <button
                type="button"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[13px] border border-white/15 bg-white/[0.07] px-4 text-sm font-extrabold text-[#e7ebf2] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/50 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] disabled:cursor-default disabled:opacity-45"
                disabled={deleteBusy}
                onClick={() => setDeleteDayOpen(false)}
              >
                Отмена
              </button>
              <button
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[13px] border border-[#ff7699]/40 bg-[linear-gradient(135deg,rgba(222,65,106,0.95),rgba(169,39,78,0.95))] px-4 text-sm font-extrabold text-white shadow-[0_10px_28px_rgba(214,59,100,0.22)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_34px_rgba(214,59,100,0.32)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7699] active:scale-[0.96] disabled:cursor-default disabled:opacity-35 disabled:hover:translate-y-0 disabled:active:scale-100"
                disabled={deleteBusy || deleteConfirm !== data.day.log_date}
              >
                {deleteBusy ? "Создаю копию…" : "Удалить безвозвратно"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}
