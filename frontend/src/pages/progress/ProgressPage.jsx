import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, Pencil, Plus, Ruler, Scale } from "lucide-react";

import { api } from "../../shared/api";
import { useReminders } from "../../shared/reminders";
import {
  CinematicHeroArt,
  ErrorState,
  Loading,
  Shell,
} from "../../shared/ui";
import MeasurementDialog from "./MeasurementDialog";
import MeasurementFieldManager from "./MeasurementFieldManager";

const CARD_CLASSES =
  "relative overflow-hidden rounded-[20px] border border-white/10 bg-[radial-gradient(circle_at_92%_8%,rgba(243,191,69,0.12),transparent_15rem),linear-gradient(145deg,rgba(24,30,47,0.97),rgba(10,15,25,0.97))] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.24)]";
const ACTION_CLASSES =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#f3bf45]/35 bg-[#f3bf45]/10 px-4 text-sm font-black text-[#f5d98c] transition-[transform,background-color] hover:bg-[#f3bf45]/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3bf45] active:scale-[0.96]";

function formatValue(value) {
  return Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function getTapeValues(measurement, fieldsBySlug) {
  return Object.entries(measurement.values || {}).map(([slug, value]) => ({
    slug,
    value,
    name: fieldsBySlug.get(slug)?.name || slug,
    unit: fieldsBySlug.get(slug)?.unit || "см",
  }));
}

function EmptyHistory({ children, actionLabel, onAction }) {
  return (
    <div className="grid justify-items-start gap-3 px-5 py-6 text-sm text-[#aeb4c3]">
      <p className="m-0">{children}</p>
      <button className={ACTION_CLASSES} onClick={onAction} type="button">
        <Plus size={17} aria-hidden="true" /> {actionLabel}
      </button>
    </div>
  );
}

export default function ProgressPage() {
  const { refreshReminders } = useReminders();
  const [data, setData] = useState(null);
  const [allFields, setAllFields] = useState([]);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(() =>
    new URLSearchParams(location.search).get("action") === "add-tape"
      ? { kind: "tape", measurement: null }
      : null,
  );

  const load = useCallback(async () => {
    setError("");
    try {
      const [progress, fieldPayload] = await Promise.all([
        api("/api/progress"),
        api("/api/measurement-fields?include_archived=true"),
      ]);
      setData(progress);
      setAllFields(fieldPayload.fields);
    } catch (reason) {
      setError(reason.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fieldsBySlug = useMemo(
    () => new Map(allFields.map((field) => [field.slug, field])),
    [allFields],
  );

  if (error) {
    return (
      <Shell active="progress" cinematic>
        <ErrorState error={error} retry={load} />
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell active="progress" cinematic>
        <Loading />
      </Shell>
    );
  }

  const weightMeasurements = data.measurements.filter(
    (measurement) => measurement.weight !== null && measurement.weight !== undefined,
  );
  const tapeMeasurements = data.measurements.filter(
    (measurement) => Object.keys(measurement.values || {}).length > 0,
  );
  const latestWeight = weightMeasurements[0];
  const latestTape = tapeMeasurements[0];
  const latestTapeValues = latestTape
    ? getTapeValues(latestTape, fieldsBySlug)
    : [];

  function openDialog(kind, measurement = null) {
    setDialog({ kind, measurement });
  }

  function closeDialog() {
    setDialog(null);
    if (new URLSearchParams(location.search).get("action") === "add-tape")
      window.history.replaceState({}, "", "/progress");
  }

  return (
    <Shell active="progress" cinematic>
      <div className="grid gap-5 text-[#f2f2f7]">
        <header
          className="cinematic-hero flex min-h-[260px] flex-col items-start justify-end gap-8 p-6 sm:p-9 xl:flex-row xl:items-end xl:justify-between"
          style={{ "--hero-accent": "#f3bf45" }}
        >
          <CinematicHeroArt />
          <div className="relative z-1">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#f3bf45]/30 bg-[#f3bf45]/10 px-3.5 text-xs font-black tracking-[0.08em] text-[#f5d98c] uppercase backdrop-blur-md">
              <BarChart3 size={15} aria-hidden="true" />
              Прогресс
            </span>
            <h1 className="mt-5 mb-3 max-w-[820px] text-[clamp(40px,3.6vw,68px)] leading-[0.98] font-black tracking-[-0.05em] text-white text-balance">
              Форма тела — <span className="text-[#f3c24f]">в цифрах</span>
            </h1>
            <p className="m-0 max-w-[700px] text-base leading-relaxed text-[#c3c6d1] text-pretty">
              Вес и сантиметровые замеры сохраняются отдельно, чтобы каждая
              история оставалась понятной.
            </p>
          </div>
          <Ruler className="relative z-1 text-[#f3bf45] drop-shadow-[0_0_28px_rgba(243,191,69,0.42)]" size={78} aria-hidden="true" />
        </header>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Последние показатели">
          <article className={CARD_CLASSES}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#f3c24f] uppercase">Последнее взвешивание</p>
                {latestWeight ? (
                  <>
                    <h2 className="m-0 text-3xl font-black text-white">{formatValue(latestWeight.weight)} кг</h2>
                    <p className="mt-2 mb-0 text-sm text-[#aeb4c3]">{latestWeight.measured_on}</p>
                  </>
                ) : (
                  <p className="m-0 text-sm text-[#aeb4c3]">Вес ещё не записан</p>
                )}
              </div>
              <Scale className="shrink-0 text-[#f3bf45]" size={28} aria-hidden="true" />
            </div>
            <button className={ACTION_CLASSES} onClick={() => openDialog("weight")} type="button">
              <Plus size={17} aria-hidden="true" /> Добавить вес
            </button>
          </article>

          <article className={CARD_CLASSES}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#f3c24f] uppercase">Последний замер тела</p>
                {latestTape ? (
                  <>
                    <h2 className="m-0 text-2xl font-black text-white">{latestTape.measured_on}</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {latestTapeValues.map((item) => (
                        <span className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-sm text-[#c7d2e1]" key={item.slug}>
                          {item.name} <b className="text-white">{formatValue(item.value)} {item.unit}</b>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="m-0 text-sm text-[#aeb4c3]">Замеров тела ещё нет</p>
                )}
              </div>
              <Ruler className="shrink-0 text-[#f3bf45]" size={28} aria-hidden="true" />
            </div>
            <button className={ACTION_CLASSES} onClick={() => openDialog("tape")} type="button">
              <Plus size={17} aria-hidden="true" /> Добавить замеры
            </button>
          </article>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,26,41,0.97),rgba(9,14,24,0.97))] shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <h2 className="m-0 border-b border-white/[0.06] bg-white/[0.025] px-5 py-4 text-xl font-black text-white">История веса</h2>
          {weightMeasurements.length ? (
            <div className="divide-y divide-white/[0.08]">
              {weightMeasurements.map((measurement) => (
                <article className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm" key={measurement.id}>
                  <div className="flex items-baseline gap-4">
                    <b className="text-white">{measurement.measured_on}</b>
                    <span className="text-[#c7d2e1]">{formatValue(measurement.weight)} кг</span>
                  </div>
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#82d7ff] transition-[transform,background-color] hover:bg-[#42a9ff]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]" onClick={() => openDialog("weight", measurement)} type="button">
                    <Pencil size={15} aria-hidden="true" /> Изменить
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyHistory actionLabel="Добавить вес" onAction={() => openDialog("weight")}>Вес ещё не записан</EmptyHistory>
          )}
        </section>

        <section className="grid gap-4">
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,26,41,0.97),rgba(9,14,24,0.97))] shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.025] px-5 py-4">
              <h2 className="m-0 text-xl font-black text-white">История замеров тела</h2>
              <button className={ACTION_CLASSES} onClick={() => openDialog("tape")} type="button">
                <Plus size={17} aria-hidden="true" /> Добавить замеры
              </button>
            </div>
            {tapeMeasurements.length ? (
              <div className="divide-y divide-white/[0.08]">
                {tapeMeasurements.map((measurement) => {
                  const values = getTapeValues(measurement, fieldsBySlug);
                  return (
                    <details className="group px-5 py-3" key={measurement.id}>
                      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                          <b className="text-white">{measurement.measured_on}</b>
                          <span className="text-[#aeb4c3]">{values.length} {values.length === 1 ? "значение" : "значения"}</span>
                          <span className="truncate text-[#c7d2e1]">
                            {values.slice(0, 3).map((item) => `${item.name} ${formatValue(item.value)}`).join(" · ")}
                            {values.length > 3 ? " · …" : ""}
                          </span>
                        </span>
                        <ChevronDown className="shrink-0 text-[#82d7ff] transition-transform group-open:rotate-180" size={20} aria-hidden="true" />
                      </summary>
                      <div className="mt-3 grid gap-4 rounded-2xl bg-white/[0.035] p-4">
                        <dl className="m-0 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {values.map((item) => (
                            <div className="flex justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm" key={item.slug}>
                              <dt className="text-[#aeb4c3]">{item.name}</dt>
                              <dd className="m-0 font-bold text-white">{formatValue(item.value)} {item.unit}</dd>
                            </div>
                          ))}
                        </dl>
                        <div>
                          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#82d7ff] transition-[transform,background-color] hover:bg-[#42a9ff]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]" onClick={() => openDialog("tape", measurement)} type="button">
                            <Pencil size={15} aria-hidden="true" /> Изменить
                          </button>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <EmptyHistory actionLabel="Добавить замеры" onAction={() => openDialog("tape")}>Замеров тела ещё нет</EmptyHistory>
            )}
          </div>

          <MeasurementFieldManager fields={allFields} onChanged={load} />
        </section>
      </div>

      {dialog && (
        <MeasurementDialog
          fields={allFields.filter(
            (field) => field.active || Object.hasOwn(dialog.measurement?.values || {}, field.slug),
          )}
          kind={dialog.kind}
          measurement={dialog.measurement}
          onClose={closeDialog}
          onSaved={async () => {
            const savedKind = dialog.kind;
            closeDialog();
            await load();
            if (savedKind === "tape") await refreshReminders();
          }}
        />
      )}
    </Shell>
  );
}
