import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, PackageOpen, Upload, X } from "lucide-react";

import { api } from "../../shared/api";

const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-white/15 bg-white/[0.07] px-4 text-sm font-extrabold text-[#e7ebf2] transition-colors hover:border-[#71b9ff]/50 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] disabled:cursor-not-allowed disabled:opacity-45";

function ParentCheckbox({ checked, indeterminate, label, onChange }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-white hover:bg-white/[0.05]">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-[#6c75ff]"
      />
      {label}
    </label>
  );
}

function selectionState(data) {
  const subgroupTemplateIds = new Set(
    data.subgroups.map((subgroup) => subgroup.template_id),
  );
  return {
    templateIds: new Set(
      data.templates
        .filter((template) => !subgroupTemplateIds.has(template.id))
        .map((template) => template.id),
    ),
    subgroupIds: new Set(data.subgroups.map((row) => row.id)),
    exerciseIds: new Set(
      data.exercises
        .filter((exercise) => !exercise.placements?.length)
        .map((exercise) => exercise.id),
    ),
    placementKeys: new Set(
      data.exercises.flatMap((exercise) =>
        exercise.placements.map(
          (placement) => `${placement.subgroup_id}:${exercise.id}`,
        ),
      ),
    ),
  };
}

function subgroupExerciseIds(data, subgroupId) {
  return data.exercises
    .filter((exercise) =>
      exercise.placements?.some((row) => row.subgroup_id === subgroupId),
    )
    .map((exercise) => exercise.id);
}

function placementKey(subgroupId, exerciseId) {
  return `${subgroupId}:${exerciseId}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 Б";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function ExercisePackDialog({ data, onClose, onImported }) {
  const [tab, setTab] = useState("export");
  const [selection, setSelection] = useState(() => selectionState(data));
  const [includeImages, setIncludeImages] = useState(false);
  const [summary, setSummary] = useState(null);
  const [pack, setPack] = useState(null);
  const [preview, setPreview] = useState(null);
  const [policy, setPolicy] = useState("skip");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const payload = useMemo(
    () => ({
      selection: {
        template_ids: [...selection.templateIds],
        subgroup_ids: [...selection.subgroupIds],
        exercise_ids: [...selection.exerciseIds],
        placements: [...selection.placementKeys].map((key) => {
          const [subgroupId, exerciseId] = key.split(":").map(Number);
          return { subgroup_id: subgroupId, exercise_id: exerciseId };
        }),
      },
      include_images: includeImages,
    }),
    [includeImages, selection],
  );
  useEffect(() => {
    if (tab !== "export") return undefined;
    const timer = setTimeout(() => {
      api("/api/exercise-packs/summary", {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then(setSummary)
        .catch((reason) => setError(reason.message));
    }, 120);
    return () => clearTimeout(timer);
  }, [payload, tab]);
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function setChildren(subgroupIds, checked) {
    setSelection((current) => {
      const nextSubgroups = new Set(current.subgroupIds);
      const nextPlacements = new Set(current.placementKeys);
      subgroupIds.forEach((subgroupId) => {
        if (checked) nextSubgroups.add(subgroupId);
        else nextSubgroups.delete(subgroupId);
        subgroupExerciseIds(data, subgroupId).forEach((exerciseId) => {
          const key = placementKey(subgroupId, exerciseId);
          if (checked) nextPlacements.add(key);
          else nextPlacements.delete(key);
        });
      });
      return { ...current, subgroupIds: nextSubgroups, placementKeys: nextPlacements };
    });
  }

  function setStandalone(kind, ids, checked) {
    setSelection((current) => {
      const key = kind === "template" ? "templateIds" : "exerciseIds";
      const nextValues = new Set(current[key]);
      ids.forEach((id) => {
        if (checked) nextValues.add(id);
        else nextValues.delete(id);
      });
      return { ...current, [key]: nextValues };
    });
  }

  function setAll(checked) {
    setSelection(
      checked
        ? selectionState(data)
        : {
            templateIds: new Set(),
            subgroupIds: new Set(),
            exerciseIds: new Set(),
            placementKeys: new Set(),
          },
    );
  }

  async function exportPack() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/exercise-packs/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Не удалось создать пак.");
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = response.headers
        .get("content-disposition")
        ?.match(/filename=([^;]+)/)?.[1]
        ?.replaceAll('"', "") || "ceo-body-exercises.ceopack.zip";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function inspectPack(file) {
    if (!file) return;
    setPack(file);
    setPreview(null);
    setResult(null);
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("pack", file);
    try {
      setPreview(
        await api("/api/exercise-packs/preview", { method: "POST", body }),
      );
    } catch (reason) {
      setPack(null);
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function importPack() {
    if (!pack || !preview) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("pack", pack);
    body.set("policy", policy);
    try {
      const nextResult = await api("/api/exercise-packs/import", {
        method: "POST",
        body,
      });
      setResult(nextResult);
      await onImported();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  const placementCount = data.exercises.reduce(
    (count, exercise) => count + exercise.placements.length,
    0,
  );
  const emptyTemplateCount = data.templates.filter(
    (template) =>
      !data.subgroups.some((subgroup) => subgroup.template_id === template.id),
  ).length;
  const unplacedExerciseCount = data.exercises.filter(
    (exercise) => !exercise.placements?.length,
  ).length;
  const selectableCount =
    placementCount + data.subgroups.length + emptyTemplateCount + unplacedExerciseCount;
  const selectedCount =
    selection.placementKeys.size +
    selection.subgroupIds.size +
    selection.templateIds.size +
    selection.exerciseIds.size;
  const allChecked = selectableCount > 0 && selectedCount === selectableCount;
  const allIndeterminate = selectedCount > 0 && !allChecked;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#02050b]/85 p-4 backdrop-blur-md">
      <section className="my-auto w-full max-w-[820px] rounded-3xl border border-white/12 bg-[linear-gradient(145deg,#171d2d,#090e18)] p-6 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)]" role="dialog" aria-modal="true" aria-labelledby="exercise-pack-title">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-xs font-extrabold tracking-[0.1em] text-[#8dcdff] uppercase">Переносимый каталог</p>
            <h2 id="exercise-pack-title" className="my-2 text-3xl font-black tracking-[-0.04em]">Паки упражнений</h2>
          </div>
          <button type="button" className="grid size-11 cursor-pointer place-items-center rounded-xl border border-white/12 bg-white/[0.05]" aria-label="Закрыть" onClick={onClose}><X /></button>
        </header>
        <div className="my-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5">
          {[['export', 'Экспорт'], ['import', 'Импорт']].map(([value, label]) => (
            <button key={value} type="button" className={`${BUTTON} ${tab === value ? "border-[#6c75ff] bg-[#6c75ff]/20 text-white" : ""}`} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>
        {tab === "export" ? (
          <div className="grid gap-4">
            <div className="max-h-[46vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#090f19]/70 p-2">
              <ParentCheckbox checked={allChecked} indeterminate={allIndeterminate} label="Выбрать всё" onChange={(event) => setAll(event.target.checked)} />
              {data.templates.map((template) => {
                const groups = data.subgroups.filter((row) => row.template_id === template.id);
                const ids = groups.flatMap((group) => subgroupExerciseIds(data, group.id));
                const selectedCount = groups.reduce(
                  (count, group) =>
                    count +
                    subgroupExerciseIds(data, group.id).filter((id) =>
                      selection.placementKeys.has(placementKey(group.id, id)),
                    ).length,
                  0,
                );
                return (
                  <div className="ml-3 border-l border-white/10 pl-2" key={template.id}>
                    <ParentCheckbox
                      checked={
                        groups.length
                          ? groups.every((group) => {
                              const groupExerciseIds = subgroupExerciseIds(data, group.id);
                              return (
                                selection.subgroupIds.has(group.id) &&
                                groupExerciseIds.every((exerciseId) =>
                                  selection.placementKeys.has(
                                    placementKey(group.id, exerciseId),
                                  ),
                                )
                              );
                            })
                          : selection.templateIds.has(template.id)
                      }
                      indeterminate={groups.length > 0 && selectedCount > 0 && selectedCount < ids.length}
                      label={template.name}
                      onChange={(event) =>
                        groups.length
                          ? setChildren(groups.map((row) => row.id), event.target.checked)
                          : setStandalone("template", [template.id], event.target.checked)
                      }
                    />
                    {groups.map((group) => {
                      const exerciseIds = subgroupExerciseIds(data, group.id);
                      const checkedCount = exerciseIds.filter((id) =>
                        selection.placementKeys.has(placementKey(group.id, id)),
                      ).length;
                      return (
                        <div className="ml-4 border-l border-white/10 pl-2" key={group.id}>
                          <ParentCheckbox checked={selection.subgroupIds.has(group.id) && checkedCount === exerciseIds.length} indeterminate={checkedCount > 0 && checkedCount < exerciseIds.length} label={group.name} onChange={(event) => setChildren([group.id], event.target.checked)} />
                          {data.exercises.filter((exercise) => exerciseIds.includes(exercise.id)).map((exercise) => (
                            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 pl-8 text-sm text-[#c9d3e2] hover:bg-white/[0.04]" key={exercise.id}>
                              <input type="checkbox" checked={selection.placementKeys.has(placementKey(group.id, exercise.id))} className="size-4 accent-[#6c75ff]" onChange={(event) => setSelection((current) => {
                                const nextPlacements = new Set(current.placementKeys);
                                const nextSubgroups = new Set(current.subgroupIds);
                                const key = placementKey(group.id, exercise.id);
                                if (event.target.checked) nextPlacements.add(key);
                                else nextPlacements.delete(key);
                                const allGroupExercisesSelected = exerciseIds.every((exerciseId) =>
                                  nextPlacements.has(placementKey(group.id, exerciseId)),
                                );
                                if (allGroupExercisesSelected) nextSubgroups.add(group.id);
                                else nextSubgroups.delete(group.id);
                                return { ...current, subgroupIds: nextSubgroups, placementKeys: nextPlacements };
                              })} />
                              {exercise.name}
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {data.exercises.some((exercise) => !exercise.placements?.length) && (
                <div className="ml-3 border-l border-white/10 pl-2">
                  <ParentCheckbox
                    checked={
                      data.exercises
                        .filter((exercise) => !exercise.placements?.length)
                        .every((exercise) => selection.exerciseIds.has(exercise.id))
                    }
                    indeterminate={
                      data.exercises.some(
                        (exercise) =>
                          !exercise.placements?.length &&
                          selection.exerciseIds.has(exercise.id),
                      ) &&
                      !data.exercises
                        .filter((exercise) => !exercise.placements?.length)
                        .every((exercise) => selection.exerciseIds.has(exercise.id))
                    }
                    label="Без размещения"
                    onChange={(event) =>
                      setStandalone(
                        "exercise",
                        data.exercises
                          .filter((exercise) => !exercise.placements?.length)
                          .map((exercise) => exercise.id),
                        event.target.checked,
                      )
                    }
                  />
                  {data.exercises
                    .filter((exercise) => !exercise.placements?.length)
                    .map((exercise) => (
                      <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 pl-8 text-sm text-[#c9d3e2] hover:bg-white/[0.04]" key={exercise.id}>
                        <input
                          type="checkbox"
                          checked={selection.exerciseIds.has(exercise.id)}
                          className="size-4 accent-[#6c75ff]"
                          onChange={(event) =>
                            setStandalone("exercise", [exercise.id], event.target.checked)
                          }
                        />
                        {exercise.name}
                      </label>
                    ))}
                </div>
              )}
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-bold"><input type="checkbox" checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} className="size-4 accent-[#6c75ff]" />Добавить изображения</label>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#64aced]/25 bg-[#253044]/55 p-4 text-sm text-[#c9d7e8]">
              <span>{summary ? `${summary.templates} дней · ${summary.subgroups} подгрупп · ${summary.exercises} упражнений · изображения ${formatBytes(summary.image_bytes)}` : "Считаю выбранное…"}</span>
              <button type="button" className={BUTTON} disabled={busy || !summary?.exercises} onClick={exportPack}><Download size={17} />{busy ? "Создаю…" : "Скачать пак"}</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="grid min-h-28 cursor-pointer place-items-center rounded-2xl border border-dashed border-[#5bb2ff]/45 bg-[#42a9ff]/[0.07] p-5 text-center text-sm font-extrabold text-[#9fd5ff]">
              <span><Upload className="mx-auto mb-2" />{pack?.name || "Выбрать .ceopack.zip"}</span>
              <input className="sr-only" type="file" accept=".zip,.ceopack.zip,application/zip" onChange={(event) => inspectPack(event.target.files?.[0])} />
            </label>
            {preview && (
              <div className="grid gap-3 rounded-2xl border border-white/[0.08] bg-[#090f19]/70 p-4">
                <b>Предпросмотр: {preview.summary.templates} дней, {preview.summary.subgroups} подгрупп, {preview.summary.exercises} упражнений, {preview.summary.images} изображений</b>
                <div className="max-h-44 overflow-y-auto text-sm text-[#b8c5d6]">{preview.templates.map((template) => <div key={template.key} className="py-1"><strong className="text-white">{template.name}</strong>{template.subgroups.map((group) => <span className="ml-3" key={group.key}>{group.name} ({group.exercise_count})</span>)}</div>)}</div>
                <label className="grid gap-2 text-sm font-extrabold text-[#c7cfdb]">При совпадении названий<select className="min-h-11 rounded-xl border border-white/12 bg-[#161e2d] px-3 text-white" value={policy} onChange={(event) => setPolicy(event.target.value)}><option value="skip">Пропустить существующие</option><option value="replace">Заменить данные существующих</option><option value="copy">Создать копии с новым названием</option></select></label>
                <button type="button" className={BUTTON} disabled={busy} onClick={importPack}><PackageOpen size={17} />{busy ? "Импортирую…" : "Импортировать целиком"}</button>
              </div>
            )}
            {result && <p className="m-0 rounded-xl border border-[#74d89b]/30 bg-[#4bc97d]/10 px-4 py-3 text-sm text-[#baf1ce]">Готово: создано {result.created}, обновлено {result.updated}, пропущено {result.skipped}, ошибок {result.errors.length}.</p>}
          </div>
        )}
        {error && <p className="mt-4 mb-0 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-3 py-2.5 text-sm text-[#ffb5c8]">{error}</p>}
      </section>
    </div>
  );
}
