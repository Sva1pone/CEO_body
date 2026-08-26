import React, { useState } from "react";
import { Archive, Plus, RotateCcw, Settings2 } from "lucide-react";

import { api } from "../../shared/api";

const INPUT_CLASSES = "min-h-10 min-w-0 rounded-xl border border-white/14 bg-[#182131] px-3 text-base text-white outline-none focus:border-[#71b9ff]/70";
const BUTTON_CLASSES = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 text-sm font-bold text-[#c7d2e1] transition-[transform,background-color] hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45";

export default function MeasurementFieldManager({ fields, onChanged }) {
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  async function createField(event) {
    event.preventDefault();
    await run("create", async () => {
      await api("/api/measurement-fields", {
        method: "POST",
        body: JSON.stringify({ name: newName }),
      });
      setNewName("");
    });
  }

  async function updateField(field, changes) {
    await run(String(field.id), async () => {
      await api(`/api/measurement-fields/${field.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setDrafts((current) => ({ ...current, [field.id]: undefined }));
    });
  }

  async function run(key, action) {
    setBusyKey(key);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <details className="rounded-[20px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,26,41,0.97),rgba(9,14,24,0.97))] p-5 text-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl text-sm font-black text-[#f5d98c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]">
        <Settings2 size={19} aria-hidden="true" /> Управление частями тела
      </summary>
      <div className="mt-5 grid gap-5">
        <form className="flex flex-wrap gap-3" onSubmit={createField}>
          <label className="grid min-w-[220px] flex-1 gap-2 text-sm font-bold text-[#c7d2e1]">
            Новая часть тела
            <input className={INPUT_CLASSES} value={newName} onChange={(event) => setNewName(event.target.value)} />
          </label>
          <button className={`${BUTTON_CLASSES} self-end`} disabled={busyKey === "create"}>
            <Plus size={16} aria-hidden="true" /> Добавить поле
          </button>
        </form>
        <div className="grid gap-2">
          {fields.map((field) => {
            const draft = drafts[field.id] ?? {
              name: field.name,
              sortOrder: field.sort_order,
            };
            return (
              <div className="grid gap-2 rounded-2xl bg-white/[0.035] p-3 sm:grid-cols-[minmax(0,1fr)_110px_auto_auto]" key={field.id}>
                <label className="grid gap-1 text-xs font-bold text-[#aeb4c3]">
                  Название
                  <input className={INPUT_CLASSES} value={draft.name} onChange={(event) => setDrafts({ ...drafts, [field.id]: { ...draft, name: event.target.value } })} />
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#aeb4c3]">
                  Порядок
                  <input className={INPUT_CLASSES} type="number" step="1" value={draft.sortOrder} onChange={(event) => setDrafts({ ...drafts, [field.id]: { ...draft, sortOrder: event.target.value } })} />
                </label>
                <button className={`${BUTTON_CLASSES} self-end`} disabled={busyKey === String(field.id) || (draft.name === field.name && Number(draft.sortOrder) === field.sort_order)} onClick={() => updateField(field, { name: draft.name, sort_order: Number(draft.sortOrder) })} type="button">Сохранить</button>
                <button className={`${BUTTON_CLASSES} self-end`} disabled={busyKey === String(field.id)} onClick={() => updateField(field, { active: !field.active })} type="button">
                  {field.active ? <Archive size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
                  {field.active ? "Архивировать" : "Вернуть"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="m-0 min-h-5 text-sm text-[#ffb5c8]" role="alert">{error}</p>
      </div>
    </details>
  );
}
