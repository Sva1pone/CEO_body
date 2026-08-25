import React, { useEffect, useRef, useState } from "react";
import { Activity, Plus, Target, X } from "lucide-react";

import { api } from "../../shared/api";
import { format } from "../../shared/format";
import { InfoTip } from "../../shared/ui";

const FIELD_LABEL_CLASSES =
  "grid gap-2 text-sm font-extrabold text-[#c3cddd]";
const FIELD_CLASSES =
  "min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#717d8f] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";

export default function CardioPanel({
  workoutId,
  data,
  setData,
  closed,
  setError,
  setToast,
}) {
  const blank = () => ({
    activity_type: "Беговая дорожка",
    duration_minutes: 15,
    watch_steps: "",
    watch_kcal: "",
    note: "",
    intervals: [
      { start_minute: 0, end_minute: 15, incline_percent: 0, speed_kmh: 4 },
    ],
  });
  const [draft, setDraft] = useState(blank());
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const sessions = data.cardio || [];
  useEffect(() => {
    if (!open) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  const resetSegments = (
    count,
    duration = Number(draft.duration_minutes) || 15,
  ) => {
    const size = duration / count;
    setDraft({
      ...draft,
      duration_minutes: duration,
      intervals: Array.from({ length: count }, (_, index) => ({
        start_minute: Number((index * size).toFixed(1)),
        end_minute: Number(((index + 1) * size).toFixed(1)),
        incline_percent: draft.intervals[index]?.incline_percent ?? 0,
        speed_kmh: draft.intervals[index]?.speed_kmh ?? 4,
      })),
    });
  };
  const changeDuration = (value) => {
    const duration = Math.max(1, Number(value) || 1);
    resetSegments(draft.intervals.length, duration);
  };
  const changeBoundary = (index, value) => {
    const next = draft.intervals.map((item) => ({ ...item }));
    const min = next[index].start_minute + 1;
    const max = next[index + 1].end_minute - 1;
    const boundary = Math.min(max, Math.max(min, Number(value)));
    next[index].end_minute = boundary;
    next[index + 1].start_minute = boundary;
    setDraft({ ...draft, intervals: next });
  };
  const updateInterval = (index, key, value) => {
    const intervals = draft.intervals.map((item, position) =>
      position === index ? { ...item, [key]: Number(value) } : item,
    );
    setDraft({ ...draft, intervals });
  };
  const edit = (session) => {
    setEditingId(session.id);
    setDraft({
      activity_type: session.activity_type,
      duration_minutes: session.duration_minutes,
      watch_steps: session.watch_steps ?? "",
      watch_kcal: session.watch_kcal ?? "",
      note: session.note || "",
      intervals: session.intervals.map((item) => ({
        start_minute: item.start_minute,
        end_minute: item.end_minute,
        incline_percent: item.incline_percent,
        speed_kmh: item.speed_kmh,
      })),
    });
    setOpen(true);
  };
  async function save(event) {
    event.preventDefault();
    if (isSavingRef.current) return;
    try {
      isSavingRef.current = true;
      setIsSaving(true);
      setData(
        await api(
          editingId
            ? `/api/cardio/${editingId}`
            : `/api/workout/${workoutId}/cardio`,
          { method: editingId ? "PATCH" : "POST", body: JSON.stringify(draft) },
        ),
      );
      setOpen(false);
      setEditingId(null);
      setDraft(blank());
      setToast("Кардио сохранено");
    } catch (reason) {
      setError(reason.message);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }
  async function remove(session) {
    if (!window.confirm("Удалить эту кардио-сессию и все её интервалы?"))
      return;
    try {
      setData(await api(`/api/cardio/${session.id}`, { method: "DELETE" }));
      setToast("Кардио удалено");
    } catch (reason) {
      setError(reason.message);
    }
  }
  return (
    <section className="mt-5 rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(22,28,44,0.97),rgba(9,14,24,0.97))] p-6 text-white shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
      <div className="mb-5 flex items-start justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#77d7ff] uppercase">Кардио</p>
          <h2 className="m-0 text-2xl font-black tracking-[-0.025em] text-white">Дорожка по интервалам</h2>
          <p className="mt-2 mb-0 max-w-[760px] text-sm leading-relaxed text-[#9fabbc]">
            Шаги и калории часов сохраняются для отчёта, но не прибавляются к
            TDEE повторно.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#42a9ff]/55 bg-[#42a9ff]/16 px-5 text-sm font-black text-[#b9e1ff] transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-[#71b9ff]/75 hover:bg-[#42a9ff]/24 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={closed}
          onClick={() => {
            setDraft(blank());
            setEditingId(null);
            setOpen(true);
          }}
        >
          <Plus size={17} /> Добавить кардио
        </button>
      </div>
      <div className="grid gap-3">
        {sessions.map((session) => (
          <article key={session.id} className="rounded-[18px] border border-white/[0.09] bg-white/[0.035] p-5">
            <header className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Activity className="text-[#70caff]" size={21} />
                <b className="text-base font-black text-white">{session.activity_type}</b>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-[#aeb8c8]">{format(session.duration_minutes)} мин</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-xs font-extrabold text-[#dce6f5] transition-colors hover:border-[#71b9ff]/40 hover:bg-[#42a9ff]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  onClick={() => edit(session)}
                  disabled={closed}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-[#ff6178]/25 bg-[#ff405f]/8 px-3.5 text-xs font-extrabold text-[#ff9bac] transition-colors hover:border-[#ff6178]/45 hover:bg-[#ff405f]/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7188] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => remove(session)}
                  disabled={closed}
                >
                  Удалить
                </button>
              </div>
            </header>
            <div className="mt-4 flex min-h-[76px] overflow-hidden rounded-xl border border-[#71b9ff]/18 bg-[#07111e]">
              {session.intervals.map((interval) => (
                <span
                  className="grid min-w-[100px] content-center border-r border-[#71b9ff]/14 px-3 py-2 last:border-r-0"
                  key={interval.id}
                  style={{ flex: interval.end_minute - interval.start_minute }}
                >
                  <b className="text-sm font-black text-[#dcecff] tabular-nums">
                    {format(interval.start_minute, 1)}–
                    {format(interval.end_minute, 1)}
                  </b>
                  <small className="mt-1 text-xs text-[#82bde7]">
                    наклон {format(interval.incline_percent, 1)}% ·{" "}
                    {format(interval.speed_kmh, 1)} км/ч
                  </small>
                </span>
              ))}
            </div>
            <footer className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#9ca8b9]">
              <span>
                Часы: {session.watch_steps ?? "—"} шагов ·{" "}
                {session.watch_kcal ?? "—"} ккал
              </span>
              <span>
                Оценка дорожки ≈ {format(session.estimated_kcal)} ккал
              </span>
              <b className="ml-auto text-[#78d5aa]">В TDEE отдельно не добавляется</b>
            </footer>
          </article>
        ))}
        {!sessions.length && (
          <div className="grid min-h-[150px] place-content-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 text-center text-sm text-[#8f9bad]">
            Кардио не внесено. Добавь его после дорожки, если оно было.
          </div>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-100 grid place-items-start overflow-y-auto bg-[#02060c]/80 p-6 backdrop-blur-xl" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <form className="relative mx-auto my-5 grid max-h-[calc(100vh-48px)] w-full max-w-[1040px] gap-5 overflow-y-auto rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] p-7 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)]" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="cardio-editor-title">
            <button
              type="button"
              className="absolute top-5 right-5 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color] hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
              onClick={() => setOpen(false)}
              aria-label="Закрыть редактор кардио"
            >
              <X />
            </button>
            <h2 className="m-0 pr-14 text-3xl font-black tracking-[-0.035em]" id="cardio-editor-title">{editingId ? "Изменить кардио" : "Добавить кардио"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className={FIELD_LABEL_CLASSES}>
                Тип
                <select
                  className={FIELD_CLASSES}
                  value={draft.activity_type}
                  onChange={(event) =>
                    setDraft({ ...draft, activity_type: event.target.value })
                  }
                >
                  <option>Беговая дорожка</option>
                  <option>Эллипс</option>
                  <option>Велотренажёр</option>
                  <option>Другое</option>
                </select>
              </label>
              <label className={FIELD_LABEL_CLASSES}>
                Общее время, мин
                <input
                  className={FIELD_CLASSES}
                  type="number"
                  min="1"
                  max="360"
                  value={draft.duration_minutes}
                  onChange={(event) => changeDuration(event.target.value)}
                />
              </label>
            </div>
            <fieldset className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4">
              <legend className="px-2 text-sm font-black text-[#dce6f5]">На сколько отрезков разделить</legend>
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <button
                  type="button"
                  key={count}
                  className={`grid size-11 cursor-pointer place-items-center rounded-xl border text-sm font-black transition-[transform,background-color,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.94] ${draft.intervals.length === count ? "border-[#71b9ff]/60 bg-[#42a9ff]/18 text-white" : "border-white/10 bg-white/[0.05] text-[#aab4c4] hover:border-[#71b9ff]/40"}`}
                  onClick={() => resetSegments(count)}
                >
                  {count}
                </button>
              ))}
            </fieldset>
            <div className="flex min-h-14 overflow-hidden rounded-xl border border-[#71b9ff]/20 bg-[#07111e]">
              {draft.intervals.map((interval, index) => (
                <span
                  className="grid min-w-[76px] place-content-center border-r border-[#71b9ff]/16 px-2 text-xs font-black text-[#dbeaff] tabular-nums last:border-r-0"
                  key={index}
                  style={{ flex: interval.end_minute - interval.start_minute }}
                >
                  {format(interval.start_minute, 1)}–
                  {format(interval.end_minute, 1)}
                </span>
              ))}
            </div>
            {draft.intervals.slice(0, -1).map((interval, index) => (
              <label className="grid gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 text-xs font-extrabold text-[#b7c2d2]" key={index}>
                Граница {index + 1}: {format(interval.end_minute, 1)} мин
                <input
                  className="h-3 w-full cursor-pointer accent-[#62b8ff]"
                  type="range"
                  min={interval.start_minute + 1}
                  max={draft.intervals[index + 1].end_minute - 1}
                  step="0.5"
                  value={interval.end_minute}
                  onChange={(event) =>
                    changeBoundary(index, event.target.value)
                  }
                />
              </label>
            ))}
            <div className="grid grid-cols-3 gap-3">
              {draft.intervals.map((interval, index) => (
                <article className="grid gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4" key={index}>
                  <b className="text-base font-black text-white">Отрезок {index + 1}</b>
                  <small className="text-xs font-bold text-[#85bde6]">
                    {format(interval.start_minute, 1)}–
                    {format(interval.end_minute, 1)} мин
                  </small>
                  <label className={FIELD_LABEL_CLASSES}>
                    Наклон, %
                    <input
                      className={FIELD_CLASSES}
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      value={interval.incline_percent}
                      onChange={(event) =>
                        updateInterval(
                          index,
                          "incline_percent",
                          event.target.value,
                        )
                      }
                    />
                    <input
                      className="h-3 w-full cursor-pointer accent-[#62b8ff]"
                      type="range"
                      min="0"
                      max="30"
                      step="0.5"
                      value={interval.incline_percent}
                      onChange={(event) =>
                        updateInterval(
                          index,
                          "incline_percent",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className={FIELD_LABEL_CLASSES}>
                    Скорость, км/ч
                    <input
                      className={FIELD_CLASSES}
                      type="number"
                      min="0"
                      max="30"
                      step="0.1"
                      value={interval.speed_kmh}
                      onChange={(event) =>
                        updateInterval(index, "speed_kmh", event.target.value)
                      }
                    />
                    <input
                      className="h-3 w-full cursor-pointer accent-[#62b8ff]"
                      type="range"
                      min="0"
                      max="20"
                      step="0.1"
                      value={interval.speed_kmh}
                      onChange={(event) =>
                        updateInterval(index, "speed_kmh", event.target.value)
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={FIELD_LABEL_CLASSES}>
                Шаги с часов
                <input
                  className={FIELD_CLASSES}
                  type="number"
                  min="0"
                  value={draft.watch_steps}
                  onChange={(event) =>
                    setDraft({ ...draft, watch_steps: event.target.value })
                  }
                  placeholder="необязательно"
                />
              </label>
              <label className={FIELD_LABEL_CLASSES}>
                Ккал с часов
                <input
                  className={FIELD_CLASSES}
                  type="number"
                  min="0"
                  step="1"
                  value={draft.watch_kcal}
                  onChange={(event) =>
                    setDraft({ ...draft, watch_kcal: event.target.value })
                  }
                  placeholder="необязательно"
                />
              </label>
            </div>
            <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[#46d391]/22 bg-[#46d391]/8 px-4 text-sm font-bold text-[#8edeb7]">
              <InfoTip text="Активные калории часов на странице дня могут уже включать дорожку. Поэтому эта запись нужна для отчёта и сравнения, но не увеличивает TDEE отдельно." />{" "}
              Без двойного учёта расхода
            </div>
            <label className={FIELD_LABEL_CLASSES}>
              Заметка
              <textarea
                className={`${FIELD_CLASSES} min-h-[100px] resize-y py-3`}
                value={draft.note}
                onChange={(event) =>
                  setDraft({ ...draft, note: event.target.value })
                }
                placeholder="Самочувствие, пульс, особенности…"
              />
            </label>
            <button disabled={isSaving} className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#42a9ff]/60 bg-[#42a9ff]/18 px-5 text-sm font-black text-[#c6e7ff] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#42a9ff]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45">{isSaving ? "Сохранение…" : "Сохранить кардио"}</button>
          </form>
        </div>
      )}
    </section>
  );
}
