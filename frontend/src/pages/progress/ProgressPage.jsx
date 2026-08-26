import React, { useEffect, useRef, useState } from "react";
import { BarChart3, Dumbbell, Plus, Sparkles, X } from "lucide-react";

import { api } from "../../shared/api";
import { format } from "../../shared/format";
import {
  CinematicHeroArt,
  ErrorState,
  Loading,
  Shell,
} from "../../shared/ui";

const FIELD_LABEL_CLASSES =
  "grid gap-2 text-sm font-extrabold text-[#c7d2e1]";
const FIELD_CLASSES =
  "min-h-12 w-full rounded-xl border border-white/14 bg-[#182131] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow] focus:border-[#71b9ff]/70 focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";

export default function ProgressPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [form, setForm] = useState({
    measured_on: new Date().toISOString().slice(0, 10),
    weight: "",
    waist: "",
    belly: "",
    shoulders: "",
    biceps: "",
    note: "",
  });
  const load = () =>
    api("/api/progress")
      .then(setData)
      .catch((reason) => setError(reason.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!data?.measurement_fields) return;
    setForm((current) => ({
      ...Object.fromEntries(
        data.measurement_fields.map((field) => [field.slug, current[field.slug] ?? ""]),
      ),
      ...current,
    }));
  }, [data?.measurement_fields]);
  useEffect(() => {
    if (!formOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setFormOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [formOpen]);
  async function save(event) {
    event.preventDefault();
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setFormError("");
    try {
      setData(
        await api("/api/progress", {
        method: "POST",
        body: JSON.stringify(form),
        }),
      );
      setFormOpen(false);
    } catch (reason) {
      setFormError(reason.message);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }
  if (error)
    return (
      <Shell active="progress" cinematic>
        <ErrorState error={error} retry={load} />
      </Shell>
    );
  if (!data)
    return (
      <Shell active="progress" cinematic>
        <Loading />
      </Shell>
    );
  const last = data.measurements[0];
  return (
    <Shell active="progress" cinematic>
      <div className="grid gap-5 text-[#f2f2f7]">
        <header
          className="cinematic-hero flex min-h-[260px] items-end justify-between gap-8 p-9"
          style={{ "--hero-accent": "#f3bf45" }}
        >
          <CinematicHeroArt />
          <div className="relative z-1">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#f3bf45]/30 bg-[#f3bf45]/10 px-3.5 text-xs font-black tracking-[0.08em] text-[#f5d98c] uppercase backdrop-blur-md">
              <BarChart3 size={15} />
              Прогресс
            </span>
            <h1 className="mt-5 mb-3 max-w-[820px] text-[clamp(40px,3.6vw,68px)] leading-[0.98] font-black tracking-[-0.05em] text-white text-balance">
              Сила и форма — <span className="text-[#f3c24f]">в цифрах</span>
            </h1>
            <p className="m-0 max-w-[700px] text-base leading-relaxed text-[#c3c6d1] text-pretty">
              Замеры, рекорды и тренировки не смешиваются с рационом, но
              остаются в одной системе.
            </p>
          </div>
          <Dumbbell className="relative z-1 text-[#f3bf45] drop-shadow-[0_0_28px_rgba(243,191,69,0.42)]" size={78} />
        </header>
        <section className="flex items-stretch gap-4">
          <article className="relative flex-1 overflow-hidden rounded-[20px] border border-white/10 bg-[radial-gradient(circle_at_92%_8%,rgba(243,191,69,0.13),transparent_15rem),linear-gradient(145deg,rgba(24,30,47,0.97),rgba(10,15,25,0.97))] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.24)] after:absolute after:top-4 after:right-4 after:text-[9px] after:font-black after:tracking-[0.16em] after:text-[#f3bf45]/55 after:content-['MEASURE_//_VERIFIED']">
            <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#f3c24f] uppercase">Последний замер</p>
            {last ? (
              <>
                <h2 className="mt-0 mb-4 text-2xl font-black text-white">{last.measured_on}</h2>
                <div className="flex flex-wrap gap-2.5">
                  <span className="rounded-xl border border-white/[0.06] bg-white/[0.05] px-3 py-2.5 text-sm text-[#aeb4c3]">
                    <b className="text-lg text-white">{last.weight || "—"}</b> кг
                  </span>
                  <span className="rounded-xl border border-white/[0.06] bg-white/[0.05] px-3 py-2.5 text-sm text-[#aeb4c3]">
                    <b className="text-lg text-white">{last.waist || "—"}</b> талия
                  </span>
                  <span className="rounded-xl border border-white/[0.06] bg-white/[0.05] px-3 py-2.5 text-sm text-[#aeb4c3]">
                    <b className="text-lg text-white">{last.belly || "—"}</b> живот
                  </span>
                  <span className="rounded-xl border border-white/[0.06] bg-white/[0.05] px-3 py-2.5 text-sm text-[#aeb4c3]">
                    <b className="text-lg text-white">{last.biceps || "—"}</b> бицепс
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#aeb4c3]">Замеров пока нет.</p>
            )}
          </article>
          <button className="inline-flex min-h-[120px] min-w-[190px] cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-[#f3bf45]/35 bg-[#f3bf45]/10 px-5 text-sm font-black text-[#f5d98c] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#f3bf45]/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3bf45] active:scale-[0.97]" onClick={() => setFormOpen(true)}>
            <Plus size={18} /> Новый замер
          </button>
        </section>
        <section className="grid grid-cols-3 gap-3">
          {data.records.map((record) => (
            <article className="group relative isolate overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,32,50,0.98),rgba(10,15,25,0.98))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)] transition-[transform,border-color,box-shadow] after:absolute after:right-0 after:bottom-[-22px] after:-z-1 after:text-[92px] after:font-black after:tracking-[-0.09em] after:text-white/[0.026] after:content-['PR'] hover:-translate-y-1 hover:border-[#f3bf45]/30 hover:shadow-[0_20px_44px_rgba(0,0,0,0.3)]" key={record.exercise}>
              <Sparkles className="text-[#f1bd42]" size={20} />
              <small className="mt-3 block text-xs text-[#a9afbf]">Лучший результат</small>
              <h2 className="my-2 text-lg font-black text-white">{record.exercise}</h2>
              <b className="text-base text-[#82d7ff] drop-shadow-[0_0_12px_rgba(66,169,255,0.2)]">
                {format(record.max_weight)} кг{" "}
                <span className="text-sm text-[#c3c7d2]">· 1RM {format(record.estimated_1rm)}</span>
              </b>
              <p className="mt-3 mb-0 text-sm leading-relaxed text-[#b9c3d3]">
                Повторы по весам:{" "}
                {(record.rep_records || [])
                  .map((item) => `${format(item.weight)} × ${item.reps}`)
                  .join(" · ") || "—"}
              </p>
            </article>
          ))}
          {!data.records.length && (
            <p className="col-span-3 m-0 rounded-2xl border border-dashed border-white/18 p-6 text-sm text-[#aeb4c3]">
              Внеси первую тренировку — здесь появятся личные рекорды.
            </p>
          )}
        </section>
        <section className="overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,26,41,0.97),rgba(9,14,24,0.97))] shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <h2 className="m-0 border-b border-white/[0.06] bg-white/[0.025] px-5 py-4 text-xl font-black text-white">История замеров</h2>
          {data.measurements.map((item) => (
            <article className="grid min-h-14 grid-cols-[145px_repeat(5,1fr)] items-center gap-3 border-t border-white/[0.08] px-5 py-3 text-sm text-[#aeb4c3] transition-colors first:border-t-0 hover:bg-[#42a9ff]/[0.055]" key={item.id}>
              <b className="text-white">{item.measured_on}</b>
              <span>Вес {item.weight || "—"} кг</span>
              <span>Талия {item.waist || "—"} см</span>
              <span>Живот {item.belly || "—"} см</span>
              <span>Плечи {item.shoulders || "—"} см</span>
              <span>Бицепс {item.biceps || "—"} см</span>
            </article>
          ))}
        </section>
        {formOpen && (
          <div className="fixed inset-0 z-100 grid place-items-start overflow-y-auto bg-[#02060c]/80 p-6 backdrop-blur-xl" onMouseDown={(event) => event.target === event.currentTarget && setFormOpen(false)}>
            <form className="relative mx-auto my-5 grid max-h-[calc(100vh-48px)] w-full max-w-[620px] gap-4 overflow-y-auto rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] p-7 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)]" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="measurement-dialog-title">
              <button
                type="button"
                className="absolute top-5 right-5 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color] hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
                onClick={() => setFormOpen(false)}
                aria-label="Закрыть форму замера"
              >
                <X />
              </button>
              <h2 className="m-0 pr-14 text-3xl font-black tracking-[-0.035em]" id="measurement-dialog-title">Новый замер</h2>
              <label className={FIELD_LABEL_CLASSES}>
                Дата
                <input
                  className={`${FIELD_CLASSES} [color-scheme:dark]`}
                  type="date"
                  value={form.measured_on}
                  onChange={(event) =>
                    setForm({ ...form, measured_on: event.target.value })
                  }
                />
              </label>
              {[
                { slug: "weight", name: "Вес", unit: "кг" },
                ...(data.measurement_fields || []),
              ].map(({ slug: key, name, unit }) => (
                <label className={FIELD_LABEL_CLASSES} key={key}>
                  {name}, {unit}
                  <input
                    className={FIELD_CLASSES}
                    type="number"
                    step="0.1"
                    value={form[key]}
                    onChange={(event) =>
                      setForm({ ...form, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
              <label className={FIELD_LABEL_CLASSES}>
                Заметка
                <textarea
                  className={`${FIELD_CLASSES} min-h-[100px] resize-y py-3`}
                  value={form.note}
                  onChange={(event) =>
                    setForm({ ...form, note: event.target.value })
                  }
                />
              </label>
              {formError && (
                <p className="m-0 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-3 py-2.5 text-sm leading-relaxed text-[#ffb5c8]">
                  {formError}
                </p>
              )}
              <button disabled={isSaving} className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#f3bf45]/45 bg-[#f3bf45]/14 px-5 text-sm font-black text-[#f5d98c] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#f3bf45]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3bf45] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45">{isSaving ? "Сохраняю…" : "Сохранить замер"}</button>
            </form>
          </div>
        )}
      </div>
    </Shell>
  );
}
