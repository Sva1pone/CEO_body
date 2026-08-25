import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Dumbbell,
  Flame,
  Plus,
  Timer,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

import { api } from "../../shared/api";
import { format } from "../../shared/format";
import {
  CinematicHeroArt,
  ErrorState,
  InfoTip,
  Loading,
  Shell,
} from "../../shared/ui";
import CardioPanel from "./CardioPanel";

const PANEL_CLASSES =
  "rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(22,28,44,0.97),rgba(9,14,24,0.97))] text-white shadow-[0_18px_48px_rgba(0,0,0,0.24)]";
const FIELD_LABEL_CLASSES =
  "grid gap-2 text-sm font-extrabold text-[#b9c4d4]";
const FIELD_CLASSES =
  "min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#717d8f] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";
const QUIET_BUTTON_CLASSES =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-sm font-extrabold text-[#dce6f5] transition-[transform,background-color,border-color,color] hover:border-[#71b9ff]/45 hover:bg-[#42a9ff]/14 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40";

function exerciseBlockKey(exercise) {
  if (exercise.exercise_catalog_id) {
    return `catalog:${exercise.exercise_catalog_id}`;
  }

  return `legacy:${exercise.exercise}`;
}

export default function WorkoutPage() {
  const workoutId = location.pathname.split("/").filter(Boolean).at(-1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [exerciseDialog, setExerciseDialog] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const isAddingExerciseRef = useRef(false);
  const [exerciseBlock, setExerciseBlock] = useState({
    exercise_id: "",
    set_count: 3,
  });
  const [setDrafts, setSetDrafts] = useState({});
  const setDraftsRef = useRef({});
  const setSaveChainsRef = useRef({});
  const setSaveVersionsRef = useRef({});
  const exerciseCardRefs = useRef({});
  const [pendingExerciseReveal, setPendingExerciseReveal] = useState("");
  const [highlightedExercise, setHighlightedExercise] = useState("");
  const [collapsedExercises, setCollapsedExercises] = useState({});
  const [meta, setMeta] = useState({
    title: "",
    duration_minutes: 75,
    intensity_met: 3.5,
    note: "",
  });
  const load = () => {
    setError("");
    api(`/api/workout/${workoutId}`)
      .then(setData)
      .catch((reason) => setError(reason.message));
  };
  useEffect(load, [workoutId]);
  useEffect(() => {
    if (!data) return;
    setMeta({
      title: data.workout.title,
      duration_minutes: data.workout.duration_minutes,
      intensity_met: data.workout.intensity_met,
      note: data.workout.note || "",
    });
  }, [data?.workout?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!pendingExerciseReveal) return;

    const frame = window.requestAnimationFrame(() => {
      const card = exerciseCardRefs.current[pendingExerciseReveal];
      if (!card) return;

      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedExercise(pendingExerciseReveal);
      setPendingExerciseReveal("");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data, pendingExerciseReveal]);
  useEffect(() => {
    if (!highlightedExercise) return;
    const timer = setTimeout(() => setHighlightedExercise(""), 1100);
    return () => clearTimeout(timer);
  }, [highlightedExercise]);
  const grouped = useMemo(() => {
    const result = {};
    (data?.sets || []).forEach((item) => {
      const key = exerciseBlockKey(item);
      (result[key] ||= {
        catalogId: item.exercise_catalog_id || null,
        name: item.exercise,
        sets: [],
      }).sets.push(item);
    });
    return result;
  }, [data]);
  async function addExerciseBlock(event) {
    event.preventDefault();
    if (isAddingExerciseRef.current) return;
    const selectedExercise = availableExercises.find(
      (exercise) =>
        Number(exercise.id) === Number(exerciseBlock.exercise_id),
    );
    try {
      isAddingExerciseRef.current = true;
      setIsAddingExercise(true);
      const updatedData = await api(`/api/workout/${workoutId}/exercise`, {
        method: "POST",
        body: JSON.stringify(exerciseBlock),
      });
      setData(updatedData);
      setExerciseDialog(false);
      setPendingExerciseReveal(
        selectedExercise ? `catalog:${selectedExercise.id}` : "",
      );
      setToast("Упражнение и подходы добавлены");
    } catch (reason) {
      setError(reason.message);
    } finally {
      isAddingExerciseRef.current = false;
      setIsAddingExercise(false);
    }
  }

  function updateSetDraft(setId, updates) {
    const nextDrafts = {
      ...setDraftsRef.current,
      [setId]: {
        ...(setDraftsRef.current[setId] || {}),
        ...updates,
      },
    };

    setDraftsRef.current = nextDrafts;
    setSetDrafts(nextDrafts);
  }

  function clearSavedSetDraft(setId, savedPayload) {
    setSetDrafts((currentDrafts) => {
      const currentSetDraft = currentDrafts[setId] || {};
      const unsavedFields = Object.fromEntries(
        Object.entries(currentSetDraft).filter(
          ([field, value]) => String(value) !== String(savedPayload[field]),
        ),
      );
      const nextDrafts = { ...currentDrafts };

      if (Object.keys(unsavedFields).length) {
        nextDrafts[setId] = unsavedFields;
      } else {
        delete nextDrafts[setId];
      }

      setDraftsRef.current = nextDrafts;
      return nextDrafts;
    });
  }

  async function saveSet(item, updates) {
    const draft = setDraftsRef.current[item.id] || {};
    const payload = {
      weight: draft.weight ?? item.weight,
      reps: draft.reps ?? item.reps,
      note: draft.note ?? item.note ?? "",
      is_warmup: draft.is_warmup ?? Boolean(item.is_warmup),
      ...updates,
    };
    const requestVersion =
      (setSaveVersionsRef.current[item.id] || 0) + 1;
    setSaveVersionsRef.current[item.id] = requestVersion;
    const previousSave = setSaveChainsRef.current[item.id] || Promise.resolve();
    const currentSave = previousSave
      .catch(() => undefined)
      .then(() =>
        api(`/api/workout/set/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      );
    setSaveChainsRef.current[item.id] = currentSave;

    try {
      const updatedData = await currentSave;

      if (setSaveVersionsRef.current[item.id] !== requestVersion) return;

      setData(updatedData);
      clearSavedSetDraft(item.id, payload);
    } catch (reason) {
      if (setSaveVersionsRef.current[item.id] !== requestVersion) return;
      setError(reason.message);
    } finally {
      if (setSaveChainsRef.current[item.id] === currentSave) {
        delete setSaveChainsRef.current[item.id];
      }
    }
  }
  async function deleteSet(setId) {
    if (!window.confirm("Удалить этот подход?")) return;
    try {
      setData(await api(`/api/workout/set/${setId}`, { method: "DELETE" }));
      setToast("Подход удалён");
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function addBlankSet(exercise) {
    try {
      setData(
        await api(`/api/workout/${workoutId}/set`, {
          method: "POST",
          body: JSON.stringify({ exercise, weight: 0, reps: 0, blank: true }),
        }),
      );
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function deleteExercise({ catalogId, exercise }) {
    if (
      !window.confirm(
        `Удалить «${exercise}» и все его подходы из этой тренировки?`,
      )
    )
      return;
    try {
      setData(
        await api(`/api/workout/${workoutId}/exercise`, {
          method: "DELETE",
          body: JSON.stringify({
            exercise,
            exercise_catalog_id: catalogId,
          }),
        }),
      );
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function saveMeta(event) {
    event.preventDefault();
    try {
      setData(
        await api(`/api/workout/${workoutId}`, {
          method: "PATCH",
          body: JSON.stringify(meta),
        }),
      );
      setToast("Параметры тренировки обновлены");
    } catch (reason) {
      setError(reason.message);
    }
  }
  if (error && !data)
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
  const closed = Boolean(data.workout.day_closed_at);
  const previewWorkoutKcal = Math.max(
    0,
    (((Number(meta.intensity_met || 0) - 1) * 3.5 * Number(data.weight || 74)) /
      200) *
      Number(meta.duration_minutes || 0),
  );
  const availableExercises = (data.available_exercises || []).filter(
    (exercise) => !grouped[`catalog:${exercise.id}`],
  );

  function openExerciseDialog() {
    setError("");
    setExerciseBlock((current) => ({
      ...current,
      exercise_id: availableExercises.some(
        (exercise) => Number(exercise.id) === Number(current.exercise_id),
      )
        ? current.exercise_id
        : availableExercises[0]?.id || "",
    }));
    setExerciseDialog(true);
  }
  return (
    <Shell active="today" cinematic>
      <div className="text-[#e8edf5]">
        {toast && (
          <div className="fixed top-5 right-6 z-100 flex min-h-12 items-center gap-2 rounded-xl border border-[#65d9a0]/30 bg-[#10271e]/95 px-4 text-sm font-extrabold text-[#93efc0] shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <Check size={18} /> {toast}
          </div>
        )}
        <header
          className="cinematic-hero mb-5 flex min-h-[260px] items-end justify-between gap-8 px-9 py-8"
          style={{ "--hero-accent": "#f60a2c" }}
        >
          <CinematicHeroArt />
          <div className="relative z-1 max-w-[820px]">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#ff6178]/35 bg-[#ff405f]/12 px-3.5 text-xs font-black tracking-[0.08em] text-[#ff9aaa] uppercase backdrop-blur-md">
              <Dumbbell size={15} />
              Журнал тренировки
            </span>
            <h1 className="mt-5 mb-3 max-w-[780px] text-[clamp(38px,3.3vw,64px)] leading-[0.98] font-black tracking-[-0.055em] text-white text-balance">
              {data.workout.title} — <span className="text-[#ff7d91]">каждый подход виден</span>
            </h1>
            <p className="m-0 max-w-[760px] text-base leading-relaxed text-[#bec8d7] text-pretty">
              {data.workout.log_date} · расход считается по длительности и
              выбранной интенсивности, а веса и повторы остаются для истории и
              рекордов.
            </p>
          </div>
          <div className="relative z-1 grid min-w-[190px] justify-items-end rounded-[22px] border border-[#ff405f]/35 bg-[#060b13]/78 p-5 text-right shadow-[0_0_38px_rgba(255,64,95,0.13)] backdrop-blur-xl">
            <Flame className="text-[#ff6077]" size={26} />
            <strong className="mt-3 text-4xl leading-none font-black tracking-[-0.05em] text-white tabular-nums">{format(previewWorkoutKcal)}</strong>
            <span className="mt-1 text-xs font-extrabold tracking-[0.06em] text-[#ff9aaa] uppercase">ккал силовой</span>
          </div>
        </header>
        <a className="mb-4 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-extrabold text-[#9fd3ff] no-underline transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]" href={`/?date=${data.workout.log_date}`}>
          ← Вернуться в день
        </a>
        {error && (
          <div className="mb-4 flex min-h-12 items-center justify-between gap-4 rounded-xl border border-[#ff6178]/30 bg-[#ff405f]/10 px-4 text-sm font-bold text-[#ffafbc]">
            <span>{error}</span>
            <button
              type="button"
              className="grid size-9 cursor-pointer place-items-center rounded-lg border-0 bg-white/[0.06] text-[#ffafbc]"
              onClick={() => setError("")}
              aria-label="Закрыть ошибку"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {closed && (
          <div className="mb-4 flex min-h-12 items-center gap-2 rounded-xl border border-[#46d391]/25 bg-[#46d391]/10 px-4 text-sm text-[#99e9c1]">
            <Check size={18} /> День закрыт. Открой его на странице «Сегодня»,
            чтобы менять тренировку.
          </div>
        )}
        <section className="grid grid-cols-[minmax(0,1.5fr)_minmax(340px,0.5fr)] items-start gap-5">
          <div className="grid gap-5">
            <section className={`${PANEL_CLASSES} p-6`}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#ff7890] uppercase">Конструктор тренировки</p>
                  <h2 className="m-0 text-2xl font-black tracking-[-0.025em] text-white">Упражнения и подходы</h2>
                </div>
                <InfoTip text="Сначала выбери упражнение и число подходов. Затем заполни вес и повторы в появившихся строках." />
              </div>
              <button
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(109,93,252,0.25)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(109,93,252,0.34)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={closed}
                onClick={openExerciseDialog}
              >
                <Plus size={18} /> Добавить упражнение в тренировку
              </button>
            </section>
            <section className={`${PANEL_CLASSES} p-6`}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#8dcfff] uppercase">Сегодня</p>
                  <h2 className="m-0 text-2xl font-black tracking-[-0.025em] text-white">Выполненные упражнения</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-bold text-[#aeb8c8]">{data.sets.length} подходов</span>
              </div>
              {Object.entries(grouped).map(([exerciseKey, block]) => {
                const { catalogId, name: exercise, sets } = block;
                const previous = data.previous?.[exercise];
                const metaExercise = data.exercise_meta?.[exercise];
                return (
                  <article
                    ref={(node) => {
                      if (node) exerciseCardRefs.current[exerciseKey] = node;
                    }}
                    data-exercise-name={exercise}
                    data-exercise-catalog-id={catalogId || undefined}
                    data-arrival={highlightedExercise === exerciseKey ? "true" : "false"}
                    className={`mt-3 overflow-hidden rounded-[18px] border bg-white/[0.025] transition-[border-color,box-shadow] ${highlightedExercise === exerciseKey ? "animate-[workout-card-arrival_900ms_ease-out] border-[#71b9ff]/70 shadow-[0_0_42px_rgba(66,169,255,0.28)]" : "border-white/10"}`}
                    key={exerciseKey}
                  >
                    <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
                      <div className="flex min-h-12 items-center gap-3">
                        <div>
                          <h3 className="m-0 text-lg font-black text-white">{exercise}</h3>
                          {metaExercise?.muscle_group && (
                            <small className="mt-1 block text-xs text-[#a9b8cb]">{metaExercise.muscle_group}</small>
                          )}
                          {previous && (
                            <small className="mt-1 block text-xs text-[#8390a3]">
                              раньше максимум {format(previous.best_weight, 1)}{" "}
                              кг · e1RM {format(previous.best_1rm, 1)}
                            </small>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={QUIET_BUTTON_CLASSES}
                          type="button"
                          onClick={() =>
                            setCollapsedExercises({
                              ...collapsedExercises,
                              [exerciseKey]: !collapsedExercises[exerciseKey],
                            })
                          }
                        >
                          {collapsedExercises[exerciseKey] ? "Раскрыть" : "Скрыть"}
                        </button>
                        <button
                          type="button"
                          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[#ff6178]/25 bg-[#ff405f]/8 px-4 text-sm font-extrabold text-[#ff9bac] transition-[transform,background-color,border-color] hover:border-[#ff6178]/45 hover:bg-[#ff405f]/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7188] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => deleteExercise({ catalogId, exercise })}
                          disabled={closed}
                        >
                          Удалить
                        </button>
                      </div>
                    </header>
                    {!collapsedExercises[exerciseKey] && (
                      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-stretch">
                        <div className="grid min-w-0 content-start">
                          {sets.map((item) => {
                            const draft = setDrafts[item.id] || {};
                            const weight = draft.weight ?? item.weight;
                            const reps = draft.reps ?? item.reps;
                            const records = [];
                            if (
                              !item.is_warmup &&
                              Number(item.reps) > 0 &&
                              previous
                            ) {
                              if (
                                Number(item.weight) >
                                Number(previous.best_weight || 0)
                              )
                                records.push("вес");
                              if (
                                Number(item.estimated_1rm) >
                                Number(previous.best_1rm || 0)
                              )
                                records.push("1RM");
                              const old = (previous.reps_by_weight || []).find(
                                (row) =>
                                  Number(row.weight) === Number(item.weight),
                              );
                              if (
                                old &&
                                Number(item.reps) > Number(old.best_reps)
                              )
                                records.push("повторы");
                            }
                            return (
                              <div
                                key={item.id}
                                data-workout-set-row
                                className={`grid min-h-28 grid-cols-[46px_minmax(170px,1fr)_26px_minmax(170px,1fr)_132px_150px_48px] items-center gap-3.5 border-t border-white/[0.055] px-4 py-4 first:border-t-0 ${item.is_warmup ? "border-l-[3px] border-l-[#e6b85b] bg-[#e6b85b]/[0.06]" : ""}`}
                              >
                                <span className="text-sm font-black text-[#ff8295] tabular-nums">#{item.set_number}</span>
                                <label className="grid gap-1.5 text-xs font-extrabold text-[#c3cfdd]">
                                  кг
                                  <input
                                    className={`${FIELD_CLASSES} min-h-10 py-2 text-base font-bold tabular-nums`}
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={weight}
                                    onChange={(event) =>
                                      updateSetDraft(item.id, {
                                        weight: event.target.value,
                                      })
                                    }
                                    onBlur={() => saveSet(item, { weight })}
                                    disabled={closed}
                                  />
                                  <input
                                    className="h-3 w-full cursor-pointer accent-[#62b8ff]"
                                    type="range"
                                    min="0"
                                    max="300"
                                    step="2.5"
                                    value={Math.min(300, Number(weight) || 0)}
                                    onChange={(event) =>
                                      updateSetDraft(item.id, {
                                        weight: event.target.value,
                                      })
                                    }
                                    onBlur={() => saveSet(item)}
                                    disabled={closed}
                                  />
                                </label>
                                <b className="text-center text-xl font-black text-[#ff8295]">×</b>
                                <label className="grid gap-1.5 text-xs font-extrabold text-[#c3cfdd]">
                                  повт.
                                  <input
                                    className={`${FIELD_CLASSES} min-h-10 py-2 text-base font-bold tabular-nums`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={reps}
                                    onChange={(event) =>
                                      updateSetDraft(item.id, {
                                        reps: event.target.value,
                                      })
                                    }
                                    onBlur={() => saveSet(item, { reps })}
                                    disabled={closed}
                                  />
                                  <input
                                    className="h-3 w-full cursor-pointer accent-[#62b8ff]"
                                    type="range"
                                    min="0"
                                    max="30"
                                    step="1"
                                    value={Math.min(30, Number(reps) || 0)}
                                    onChange={(event) =>
                                      updateSetDraft(item.id, {
                                        reps: event.target.value,
                                      })
                                    }
                                    onBlur={() => saveSet(item)}
                                    disabled={closed}
                                  />
                                </label>
                                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-extrabold text-[#f3c978]">
                                  <input
                                    className="size-5 accent-[#e6b85b]"
                                    type="checkbox"
                                    checked={Boolean(item.is_warmup)}
                                    onChange={(event) =>
                                      saveSet(item, {
                                        is_warmup: event.target.checked,
                                      })
                                    }
                                    disabled={closed}
                                  />{" "}
                                  разминка
                                </label>
                                <div
                                  data-workout-set-status
                                  className="flex min-h-10 w-[150px] items-center justify-center"
                                >
                                  {item.is_warmup ? (
                                    <span className="inline-flex items-center rounded-full border border-[#e6b85b]/30 bg-[#e6b85b]/10 px-3 py-1.5 text-xs font-black text-[#f0cb7e]">
                                      разминочный
                                    </span>
                                  ) : records.length > 0 ? (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#f3bf45]/35 bg-[#f3bf45]/12 px-2.5 py-1.5 text-[10px] font-black tracking-[0.04em] text-[#f7dc8d] uppercase shadow-[0_0_18px_rgba(243,191,69,0.09)]">
                                      <Trophy size={12} /> {records.join(" · ")}
                                    </span>
                                  ) : (
                                    <span className="invisible text-xs" aria-hidden="true">
                                      нет результата
                                    </span>
                                  )}
                                </div>
                                <button
                                  data-workout-set-delete
                                  className="grid size-11 cursor-pointer place-items-center rounded-xl border-0 bg-[#ff405f]/10 text-[#e58c99] transition-[transform,background-color,color] hover:bg-[#ff405f]/20 hover:text-[#ff9cac] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7188] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35"
                                  onClick={() => deleteSet(item.id)}
                                  disabled={closed}
                                  aria-label="Удалить подход"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            className="m-3 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#71b9ff]/35 bg-[#42a9ff]/[0.06] px-4 text-sm font-extrabold text-[#9ed4ff] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/60 hover:bg-[#42a9ff]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => addBlankSet(exercise)}
                            disabled={closed}
                          >
                            <Plus size={16} /> Добавить подход
                          </button>
                        </div>
                        <aside className="m-4 min-h-[300px] overflow-hidden rounded-2xl border border-[#6fb1eb]/25 bg-[#4f6fa4]/10">
                          {metaExercise?.image_url ? (
                            <img
                              className="block h-full min-h-[300px] w-full bg-[#101725] object-contain"
                              src={metaExercise.image_url}
                              alt={`Фото упражнения ${exercise}`}
                            />
                          ) : (
                            <span className="grid h-full min-h-[300px] w-full place-content-center justify-items-center gap-3 text-[#8fc9f1]">
                              <Dumbbell size={42} />
                              <small className="text-xs text-[#8b99ad]">Фото упражнения пока нет</small>
                            </span>
                          )}
                        </aside>
                      </div>
                    )}
                  </article>
                );
              })}
              {!data.sets.length && (
                <div className="grid min-h-[180px] place-content-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 text-center text-sm text-[#8f9bad]">
                  Первый подход появится здесь сразу после сохранения.
                </div>
              )}
            </section>
          </div>
          <form className={`${PANEL_CLASSES} sticky top-5 grid gap-4 p-6`} onSubmit={saveMeta}>
            <p className="m-0 text-xs font-black tracking-[0.1em] text-[#ff7890] uppercase">Расход тренировки</p>
            <h2 className="-mt-2 mb-1 text-2xl font-black tracking-[-0.025em] text-white">Параметры сессии</h2>
            <label className={FIELD_LABEL_CLASSES}>
              Название
              <input
                className={FIELD_CLASSES}
                value={meta.title}
                onChange={(event) =>
                  setMeta({ ...meta, title: event.target.value })
                }
                required
              />
            </label>
            <label className={FIELD_LABEL_CLASSES}>
              <span>
                Длительность, мин{" "}
                <InfoTip text="Общее время силовой с разминкой и отдыхом между подходами." />
              </span>
              <input
                className={FIELD_CLASSES}
                type="number"
                min="1"
                step="1"
                value={meta.duration_minutes}
                onChange={(event) =>
                  setMeta({ ...meta, duration_minutes: event.target.value })
                }
              />
            </label>
            <label className={FIELD_LABEL_CLASSES}>
              <span>
                Интенсивность, MET{" "}
                <InfoTip text="Выбирается для всей сессии: 3.5 — обычная тренировка с несколькими упражнениями; 6.0 — плотная интенсивная силовая. Вес снаряда не переводится напрямую в калории." />
              </span>
              <input
                className={FIELD_CLASSES}
                type="number"
                min="2"
                max="8"
                step="0.1"
                value={meta.intensity_met}
                onChange={(event) =>
                  setMeta({ ...meta, intensity_met: event.target.value })
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                [3.5, "Обычно"],
                [6, "Интенсивно"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={`grid min-h-14 cursor-pointer gap-1 rounded-xl border px-3 py-2 text-sm font-black transition-[transform,background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${Number(meta.intensity_met) === value ? "border-[#71b9ff]/60 bg-[#42a9ff]/16 text-white" : "border-white/10 bg-white/[0.05] text-[#aab4c4] hover:border-[#71b9ff]/40 hover:bg-[#42a9ff]/10"}`}
                  onClick={() => setMeta({ ...meta, intensity_met: value })}
                >
                  {label}
                  <small className="text-xs text-[#85bfe9]">{value} MET</small>
                </button>
              ))}
            </div>
            <div className="grid gap-2 rounded-2xl border border-[#71b9ff]/18 bg-[#42a9ff]/[0.055] p-4 text-sm leading-relaxed text-[#aebbd0]">
              <b className="text-white">Как выбрать:</b>
              <span>
                <strong className="text-[#9dd4ff]">3.5 MET</strong> — почти всегда: обычная силовая на
                60–90 минут, нормальные паузы между подходами.
              </span>
              <span>
                <strong className="text-[#9dd4ff]">6.0 MET</strong> — только если тренировка реально
                плотная: тяжёлая работа почти без длинных пауз, много
                упражнений/подходов, заметно выше обычной нагрузки.
              </span>
              <em className="text-[#f1c978]">
                Сомневаешься — выбирай 3.5. Большой вес сам по себе не повод
                ставить 6.0.
              </em>
            </div>
            <div className="grid grid-cols-[24px_1fr] items-center gap-2 rounded-2xl border border-[#ff405f]/18 bg-[#ff405f]/[0.07] p-4 text-sm text-[#b7c0cd]">
              <Timer className="text-[#ff7188]" size={20} />
              <span>
                {format(meta.duration_minutes)} мин ×{" "}
                {format(meta.intensity_met, 1)} MET
              </span>
              <b className="col-start-2 text-xl font-black text-white tabular-nums">≈ {format(previewWorkoutKcal)} ккал</b>
            </div>
            <label className={FIELD_LABEL_CLASSES}>
              Заметка
              <textarea
                className={`${FIELD_CLASSES} min-h-[110px] resize-y py-3`}
                value={meta.note}
                onChange={(event) =>
                  setMeta({ ...meta, note: event.target.value })
                }
                placeholder="Самочувствие, восстановление…"
              />
            </label>
            <button className={QUIET_BUTTON_CLASSES} disabled={closed}>
              Сохранить параметры
            </button>
          </form>
        </section>
        <CardioPanel
          workoutId={workoutId}
          data={data}
          setData={setData}
          closed={closed}
          setError={setError}
          setToast={setToast}
        />
        {exerciseDialog && (
          <div className="fixed inset-0 z-100 grid place-items-center overflow-y-auto bg-[#02060c]/80 p-6 backdrop-blur-xl" onMouseDown={(event) => event.target === event.currentTarget && setExerciseDialog(false)}>
            <form className="relative grid w-full max-w-[560px] gap-4 rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] p-7 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)]" onSubmit={addExerciseBlock} role="dialog" aria-modal="true" aria-labelledby="add-workout-exercise-title">
              <button
                type="button"
                className="absolute top-5 right-5 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color] hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
                onClick={() => setExerciseDialog(false)}
                aria-label="Закрыть выбор упражнения"
              >
                <X />
              </button>
              <h2 className="m-0 pr-14 text-3xl font-black tracking-[-0.035em]" id="add-workout-exercise-title">Добавить упражнение</h2>
              <label className={FIELD_LABEL_CLASSES}>
                Упражнение
                <select
                  className={FIELD_CLASSES}
                  value={exerciseBlock.exercise_id}
                  onChange={(event) =>
                    setExerciseBlock({
                      ...exerciseBlock,
                      exercise_id: event.target.value,
                    })
                  }
                  disabled={!availableExercises.length}
                >
                  {availableExercises.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {!availableExercises.length && (
                  <small className="text-sm text-[#f1c978]">
                    Все упражнения этого дня уже добавлены.
                  </small>
                )}
              </label>
              <label className={FIELD_LABEL_CLASSES}>
                Количество подходов
                <input
                  className={FIELD_CLASSES}
                  type="number"
                  min="1"
                  max="12"
                  value={exerciseBlock.set_count}
                  onChange={(event) =>
                    setExerciseBlock({
                      ...exerciseBlock,
                      set_count: event.target.value,
                    })
                  }
                />
              </label>
              <button disabled={!availableExercises.length || isAddingExercise} className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 text-sm font-black text-white transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(109,93,252,0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45">{isAddingExercise ? "Добавление…" : "Создать подходы"}</button>
            </form>
          </div>
        )}
      </div>
    </Shell>
  );
}
