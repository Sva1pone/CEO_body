import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { api } from "../../shared/api";

const FIELD_LABEL_CLASSES = "grid gap-2 text-sm font-extrabold text-[#c7d2e1]";
const FIELD_CLASSES = "min-h-12 w-full rounded-xl border border-white/14 bg-[#182131] px-3.5 text-base text-white outline-none transition-[border-color,box-shadow] focus:border-[#71b9ff]/70 focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";

function createForm(kind, measurement, fields) {
  const form = {
    measured_on: measurement?.measured_on || new Date().toISOString().slice(0, 10),
    note: measurement?.note || "",
  };
  if (kind === "weight") form.weight = measurement?.weight ?? "";
  if (kind === "tape") {
    for (const field of fields) {
      form[field.slug] = measurement?.values?.[field.slug] ?? "";
    }
  }
  return form;
}

export default function MeasurementDialog({ fields, kind, measurement, onClose, onSaved }) {
  const [form, setForm] = useState(() => createForm(kind, measurement, fields));
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const firstInputRef = useRef(null);
  const title = kind === "weight" ? (measurement ? "Изменить вес" : "Добавить вес") : (measurement ? "Изменить замеры" : "Добавить замеры");

  useEffect(() => {
    const previousFocus = document.activeElement;
    firstInputRef.current?.focus();
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [onClose]);

  async function save(event) {
    event.preventDefault();
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setFormError("");
    const values = Object.fromEntries(fields.map((field) => [field.slug, form[field.slug]]));
    const payload = kind === "weight"
      ? { measured_on: form.measured_on, weight: form.weight, note: form.note }
      : { measured_on: form.measured_on, values, note: form.note };
    const endpoint = `/api/measurements/${kind}${measurement ? `/${measurement.id}` : ""}`;
    try {
      await api(endpoint, {
        method: measurement ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      await onSaved();
    } catch (reason) {
      setFormError(reason.message);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-100 grid place-items-start overflow-y-auto overscroll-contain bg-[#02060c]/80 p-4 backdrop-blur-xl sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="relative mx-auto my-5 grid max-h-[calc(100vh-48px)] w-full max-w-[620px] gap-4 overflow-y-auto rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] p-5 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)] sm:p-7" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="measurement-dialog-title">
        <button type="button" className="absolute top-5 right-5 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color] hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]" onClick={onClose} aria-label="Закрыть форму">
          <X aria-hidden="true" />
        </button>
        <h2 className="m-0 pr-14 text-3xl font-black tracking-[-0.035em]" id="measurement-dialog-title">{title}</h2>
        <label className={FIELD_LABEL_CLASSES}>
          Дата
          <input ref={firstInputRef} className={`${FIELD_CLASSES} [color-scheme:dark]`} type="date" value={form.measured_on} onChange={(event) => setForm({ ...form, measured_on: event.target.value })} />
        </label>
        {kind === "weight" ? (
          <label className={FIELD_LABEL_CLASSES}>
            Вес, кг
            <input className={FIELD_CLASSES} type="number" inputMode="decimal" min="0.1" step="0.1" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} />
          </label>
        ) : fields.map((field) => (
          <label className={FIELD_LABEL_CLASSES} key={field.slug}>
            {field.name}, {field.unit}
            <input className={FIELD_CLASSES} type="number" inputMode="decimal" min="0" step="0.1" value={form[field.slug]} onChange={(event) => setForm({ ...form, [field.slug]: event.target.value })} />
          </label>
        ))}
        <label className={FIELD_LABEL_CLASSES}>
          Заметка
          <textarea className={`${FIELD_CLASSES} min-h-[100px] resize-y py-3`} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </label>
        <p className="m-0 min-h-5 text-sm text-[#ffb5c8]" role="alert">{formError}</p>
        <button disabled={isSaving} className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#f3bf45]/45 bg-[#f3bf45]/14 px-5 text-sm font-black text-[#f5d98c] transition-[transform,background-color] hover:bg-[#f3bf45]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3bf45] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45">
          {isSaving ? "Сохраняю…" : measurement ? "Сохранить изменения" : kind === "weight" ? "Сохранить вес" : "Сохранить замеры"}
        </button>
      </form>
    </div>
  );
}
