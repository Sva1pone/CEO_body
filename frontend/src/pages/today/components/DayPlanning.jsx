import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Coffee,
  Dumbbell,
  Target,
  X,
} from "lucide-react";

import { api } from "../../../shared/api";

export function DaySetup({ data, mutate }) {
  const [training, setTraining] = useState(null);
  const [type, setType] = useState("Ноги");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function finish() {
    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const materializedDay = data.day.id
        ? data
        : await api(`/api/day?date=${encodeURIComponent(data.day.log_date)}`, {
            method: "POST",
          });
      mutate(
        await api(`/api/day/${materializedDay.day.id}/setup`, {
          method: "POST",
          body: JSON.stringify({
            training_planned: training,
            day_type: training ? type : "Отдых",
          }),
        }),
      );
    } catch (reason) {
      setError(reason.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto grid min-h-[calc(100vh-100px)] max-w-[1120px] grid-cols-[0.85fr_1.15fr] items-center gap-[70px]">
      <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[45%_55%_52%_48%] border border-white/10 bg-[linear-gradient(135deg,rgba(109,93,252,0.2),rgba(32,168,208,0.16))] shadow-[inset_0_0_80px_rgba(109,93,252,0.08)] [animation:morph_7s_ease-in-out_infinite] before:absolute before:top-[10%] before:right-[8%] before:size-[95px] before:rounded-full before:bg-[rgba(240,95,151,0.2)] before:blur-[2px] before:content-[''] after:absolute after:bottom-[12%] after:left-[8%] after:size-[68px] after:rounded-full after:bg-[rgba(32,168,208,0.2)] after:blur-[2px] after:content-[''] motion-reduce:animate-none">
        <span className="relative z-[2] grid size-[125px] -rotate-7 place-items-center rounded-4xl bg-[linear-gradient(145deg,#8577ff,#5948ed)] text-white shadow-[0_25px_55px_rgba(109,93,252,0.33)]">
          <Dumbbell size={52} />
        </span>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-extrabold tracking-[0.1em] text-[#8dcdff] uppercase">
          Шаг 1 из 2 · настройка дня
        </p>
        <h1 className="my-3 text-[clamp(42px,5vw,68px)] leading-none font-black tracking-[-0.055em] text-white text-balance">
          Сегодня будет зал?
        </h1>
        <p className="max-w-[65ch] text-base leading-relaxed text-[#b8c0cf] text-pretty">
          Один выбор настроит дневной сценарий. Подходы и веса заполнишь после
          тренировки.
        </p>
        <div className="my-7 grid grid-cols-2 gap-3">
          <button
            className={`flex min-h-[88px] cursor-pointer items-center gap-3 rounded-[17px] border p-4 text-left transition-[transform,background-color,border-color,box-shadow] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${
              training === false
                ? "border-[#71b9ff] bg-[#42a9ff]/15 text-white shadow-[0_9px_25px_rgba(66,169,255,0.12)]"
                : "border-white/12 bg-white/[0.06] text-[#e7ebf2] hover:border-[#71b9ff]/60"
            }`}
            onClick={() => setTraining(false)}
          >
            <Coffee size={22} />
            <span className="grid gap-1">
              <b className="text-lg">Нет</b>
              <small className="text-sm text-[#aeb7c6]">День отдыха</small>
            </span>
          </button>
          <button
            className={`flex min-h-[88px] cursor-pointer items-center gap-3 rounded-[17px] border p-4 text-left transition-[transform,background-color,border-color,box-shadow] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${
              training === true
                ? "border-[#71b9ff] bg-[#42a9ff]/15 text-white shadow-[0_9px_25px_rgba(66,169,255,0.12)]"
                : "border-white/12 bg-white/[0.06] text-[#e7ebf2] hover:border-[#71b9ff]/60"
            }`}
            onClick={() => setTraining(true)}
          >
            <Dumbbell size={22} />
            <span className="grid gap-1">
              <b className="text-lg">Да</b>
              <small className="text-sm text-[#aeb7c6]">
                Будет тренировка
              </small>
            </span>
          </button>
        </div>
        {training && (
          <div className="flex gap-2">
            {["Ноги", "Грудь", "Тестовый шаблон B"].map((item) => (
              <button
                key={item}
                className={`min-h-10 cursor-pointer rounded-full border px-3 text-xs font-bold transition-[transform,background-color,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${
                  type === item
                    ? "border-[#71b9ff] bg-[#71b9ff] text-[#08111d]"
                    : "border-white/15 bg-white/[0.06] text-[#b8c0cf] hover:border-[#71b9ff]/60 hover:text-white"
                }`}
                onClick={() => setType(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        <button
          className="mt-[22px] inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[var(--violet)] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96] disabled:cursor-default disabled:opacity-45 disabled:hover:translate-y-0 disabled:active:scale-100"
          disabled={training === null || busy}
          onClick={finish}
        >
          {busy ? "Сохраняю…" : "Начать с завтрака"} <ArrowRight size={19} />
        </button>
        {error && <p className="mt-4 text-sm text-[#ffb5c8]">{error}</p>}
      </div>
    </section>
  );
}

export function TrainingStarter({ data }) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || catalog) return;
    api("/api/workout/templates")
      .then((payload) => {
        setCatalog(payload);
        const matched = payload.templates.find(
          (item) =>
            data.day.day_type && item.name.startsWith(data.day.day_type),
        );
        setTemplateId(String((matched || payload.templates[0])?.id || ""));
      })
      .catch((reason) => setError(reason.message));
  }, [open, catalog, data.day.day_type]);
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, open]);
  const selected = catalog?.templates.find(
    (item) => String(item.id) === templateId,
  );
  async function start(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/day/${data.day.id}/workout`, {
        method: "POST",
        body: JSON.stringify({ template_id: Number(templateId) || null }),
      });
      location.href = `/workout/${result.workout.id}`;
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }
  return (
    <>
      <article className="training-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-white/10 bg-[#111827]/95 p-5 text-[#f6f8fc] shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
        <span className="grid size-[54px] place-items-center rounded-[17px] bg-[linear-gradient(145deg,var(--pink),#d44580)] text-white shadow-[0_9px_24px_rgba(240,95,151,0.28)]">
          <Dumbbell />
        </span>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-extrabold tracking-[0.1em] text-[#ff79a9] uppercase">
            {data.day.training_planned ? "Запланировано" : "Тренировка"}
          </p>
          <h2 className="m-0 text-xl leading-tight text-white text-balance">
            {data.day.training_planned
              ? data.day.day_type
              : "Можно начать в любой момент"}
          </h2>
          <p className="mt-1 mb-0 max-w-[75ch] text-[13px] leading-relaxed text-[#b8c0cf] text-pretty">
            {data.day.training_planned
              ? "После зала внеси упражнения, веса и повторы."
              : "Даже если утром был выбран отдых, тренировка добавится в расход этого дня."}
          </p>
        </div>
        {data.workouts.length ? (
          <a
            className="min-h-15 rounded-[25px] border border-white/15 bg-white/[0.07] px-5 text-[18px] font-extrabold text-[#f1f4fa] transition-[transform,background-color,border-color] hover:border-[#5bb7ff]/50 hover:bg-[#42a9ff]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
            href={`/workout/${data.workouts[0].id}`}
          >
            Продолжить тренировку
          </a>
        ) : (
          <button
            className="min-h-15 rounded-[25px] border border-white/15 bg-white/[0.17] px-5 text-[18px] font-extrabold text-[#f1f4fa] transition-[transform,background-color,border-color] hover:border-[#5bb7ff]/50 hover:bg-[#42a9ff]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
            onClick={() => setOpen(true)}
          >
            Начать тренировку
          </button>
        )}
      </article>
      {open && (
        <div
          className="fixed inset-0 z-100 grid place-items-center bg-[#02060c]/80 p-6 backdrop-blur-xl animate-[fadeIn_180ms_ease_both] motion-reduce:animate-none"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !busy && setOpen(false)
          }
        >
          <form
            className="relative max-h-[calc(100vh-48px)] w-full max-w-[580px] overflow-y-auto rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] p-7 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)] animate-[modalIn_280ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-start-title"
            onSubmit={start}
          >
            <button
              type="button"
              className="absolute top-5 right-5 z-10 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color,border-color] hover:border-[#71b9ff]/45 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
              disabled={busy}
              onClick={() => setOpen(false)}
              aria-label="Закрыть выбор тренировки"
            >
              <X />
            </button>
            <p className="mb-2 text-xs font-extrabold tracking-[0.1em] text-[#ff79a9] uppercase">
              Быстрый старт
            </p>
            <h2
              className="mt-0 mb-6 pr-14 text-3xl leading-tight font-black tracking-[-0.04em] text-balance"
              id="workout-start-title"
            >
              Выбери шаблон
            </h2>
            {catalog ? (
              <>
                <label className="grid gap-2 text-sm font-extrabold text-[#c7cfdb]">
                  Тренировка
                  <select
                    className="min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]"
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                  >
                    {catalog.templates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selected && (
                  <p className="my-4 rounded-xl border border-white/[0.07] bg-white/[0.045] px-4 py-3 text-sm leading-relaxed text-[#cbd3df] text-pretty">
                    Упражнения: {selected.exercises.join(" · ")}
                  </p>
                )}
                <p className="my-4 text-sm leading-relaxed text-[#9da8b8] text-pretty">
                  Длительность {selected?.default_duration_minutes || 75} мин ·
                  обычная интенсивность {selected?.default_intensity_met || 3.5}{" "}
                  MET. После старта всё можно изменить.
                </p>
                {error && (
                  <p className="my-3 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-3 py-2.5 text-sm leading-relaxed text-[#ffb5c8]">
                    {error}
                  </p>
                )}
                <button
                  className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96] disabled:cursor-default disabled:opacity-45 disabled:hover:translate-y-0 disabled:active:scale-100"
                  disabled={busy || !templateId}
                >
                  {busy ? "Создаю…" : "Открыть журнал"} <ArrowRight size={18} />
                </button>
              </>
            ) : (
              <p className="m-0 py-8 text-center text-sm text-[#aeb7c6]">
                Загружаю шаблоны…
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}
