import React, { useEffect, useState } from "react";
import { Check, Download, SlidersHorizontal } from "lucide-react";

import { api } from "../../shared/api";
import { format } from "../../shared/format";
import {
  CinematicHeroArt,
  ErrorState,
  Loading,
  Shell,
} from "../../shared/ui";

const PANEL_CLASSES =
  "rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(22,31,48,0.98),rgba(9,14,24,0.98))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.22)]";
const FIELD_LABEL_CLASSES =
  "grid gap-2 text-sm font-extrabold text-[#c7d2e1]";
const FIELD_CLASSES =
  "min-h-12 w-full rounded-xl border border-white/14 bg-[#182131] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow] placeholder:text-[#718097] focus:border-[#71b9ff]/70 focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";

function backupDownloadUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      !url.pathname.startsWith("/api/backups/")
    )
      return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

function safeBackups(backups) {
  return backups
    .map((backup) => ({
      ...backup,
      download_url: backupDownloadUrl(backup.download_url),
    }))
    .filter((backup) => backup.download_url);
}

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState("");
  const load = () =>
    api("/api/strategy")
      .then((result) => {
        setData(result);
        const active = result.active;
        setForm({
          effective_from: result.today,
          phase: active?.phase || "",
          base_tdee: active?.base_tdee || "",
          protein_min: active?.protein_min || "",
          protein_max: active?.protein_max || "",
          goal_delta: active?.goal_delta ?? "",
          note: "",
        });
      })
      .catch((reason) => setError(reason.message));
  const loadBackups = () =>
    api("/api/backups")
      .then((result) => setBackups(safeBackups(result.backups || [])))
      .catch((reason) => setBackupError(reason.message));
  useEffect(() => {
    load();
    loadBackups();
  }, []);
  async function save(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    try {
      const result = await api("/api/strategy", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setData(result);
      setSaved(true);
      setForm({ ...form, note: "" });
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function createBackup() {
    setBackupBusy(true);
    setBackupError("");
    try {
      const result = await api("/api/backups", { method: "POST" });
      setBackups(safeBackups(result.backups || []));
    } catch (reason) {
      setBackupError(reason.message);
    } finally {
      setBackupBusy(false);
    }
  }
  if (error && !data)
    return (
      <Shell active="settings" cinematic>
        <ErrorState error={error} retry={load} />
      </Shell>
    );
  if (!data || !form)
    return (
      <Shell active="settings" cinematic>
        <Loading />
      </Shell>
    );
  return (
    <Shell active="settings" cinematic>
      <div className="grid gap-5 text-[#f4f7fc]">
        <header
          className="cinematic-hero min-h-[250px] p-9"
          style={{ "--hero-accent": "#ee5d78" }}
        >
          <CinematicHeroArt />
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#67bfff]/30 bg-[#4ba9ef]/12 px-3.5 text-xs font-black tracking-[0.08em] text-[#9ed6ff] uppercase">
            <SlidersHorizontal size={15} />
            Версии стратегии
          </span>
          <h1 className="mt-5 mb-3 max-w-[1050px] text-[clamp(40px,3.6vw,68px)] leading-[0.98] font-black tracking-[-0.05em] text-white text-balance">
            Меняй правила, <span className="text-[#68bfff]">не переписывая прошлое</span>
          </h1>
          <p className="m-0 max-w-[900px] text-base leading-relaxed text-[#b6c3d5] text-pretty">
            Новая версия применяется только при создании новых дней. Уже
            существующие дни сохраняют свою фазу, базу TDEE, белковый коридор и
            цель.
          </p>
        </header>
        <section className="grid grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)] items-start gap-5">
          <form className={`${PANEL_CLASSES} grid gap-4`} onSubmit={save}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#69bfff] uppercase">Новая версия</p>
                <h2 className="m-0 text-2xl font-black text-white">Параметры стратегии</h2>
              </div>
            </div>
            <label className={FIELD_LABEL_CLASSES}>
              Дата начала действия
              <input
                className={FIELD_CLASSES}
                type="date"
                value={form.effective_from}
                onChange={(event) =>
                  setForm({ ...form, effective_from: event.target.value })
                }
                required
              />
              <small className="text-xs leading-relaxed font-medium text-[#8898ad]">
                Дни, которые уже существуют в базе, не изменятся даже при
                совпадении даты.
              </small>
            </label>
            <label className={FIELD_LABEL_CLASSES}>
              Название фазы
              <input
                className={FIELD_CLASSES}
                value={form.phase}
                onChange={(event) =>
                  setForm({ ...form, phase: event.target.value })
                }
                required
                placeholder="Например: Поддержание"
              />
            </label>
            <label className={FIELD_LABEL_CLASSES}>
              Базовый TDEE, ккал
              <input
                className={FIELD_CLASSES}
                type="number"
                min="1200"
                max="4000"
                step="10"
                value={form.base_tdee}
                onChange={(event) =>
                  setForm({ ...form, base_tdee: event.target.value })
                }
                required
              />
              <small className="text-xs leading-relaxed font-medium text-[#8898ad]">Расход почти без шагов и отдельной тренировки.</small>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={FIELD_LABEL_CLASSES}>
                Белок минимум, г
                <input
                  className={FIELD_CLASSES}
                  type="number"
                  min="50"
                  max="300"
                  step="1"
                  value={form.protein_min}
                  onChange={(event) =>
                    setForm({ ...form, protein_min: event.target.value })
                  }
                  required
                />
              </label>
              <label className={FIELD_LABEL_CLASSES}>
                Белок максимум, г
                <input
                  className={FIELD_CLASSES}
                  type="number"
                  min="50"
                  max="350"
                  step="1"
                  value={form.protein_max}
                  onChange={(event) =>
                    setForm({ ...form, protein_max: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <label className={FIELD_LABEL_CLASSES}>
              Целевая дельта, ккал
              <input
                className={FIELD_CLASSES}
                type="number"
                min="-1500"
                max="1000"
                step="50"
                value={form.goal_delta}
                onChange={(event) =>
                  setForm({ ...form, goal_delta: event.target.value })
                }
                required
              />
              <small className="text-xs leading-relaxed font-medium text-[#8898ad]">−500 означает целевой дефицит 500 ккал.</small>
            </label>
            <label className={FIELD_LABEL_CLASSES}>
              Причина изменения
              <textarea
                className={`${FIELD_CLASSES} min-h-[110px] resize-y py-3`}
                value={form.note}
                onChange={(event) =>
                  setForm({ ...form, note: event.target.value })
                }
                placeholder="Например: переход на замедленный метаболизм"
              />
            </label>
            {error && <p className="m-0 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-4 py-3 text-sm text-[#ffb5c8]">{error}</p>}
            {saved && (
              <p className="m-0 flex min-h-12 items-center gap-2 rounded-xl bg-[#40ca86]/12 px-4 text-sm font-bold text-[#7ce8b2]">
                <Check size={16} /> Новая версия сохранена. Исторические дни не
                изменены.
              </p>
            )}
            <button className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#5a8ef1]/65 bg-[#5a8ef1]/18 px-5 text-sm font-black text-[#c8e5ff] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#5a8ef1]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.97]">
              Сохранить как новую версию
            </button>
          </form>
          <aside className={`${PANEL_CLASSES} grid gap-3`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#69bfff] uppercase">История</p>
                <h2 className="m-0 text-2xl font-black text-white">Версии правил</h2>
              </div>
            </div>
            {data.versions.map((version) => (
              <article
                key={version.id}
                className={`grid gap-3 rounded-2xl border p-4 ${version.id === data.active?.id ? "border-[#5bb7f7]/45 bg-[#449ade]/10" : "border-white/[0.08] bg-white/[0.035]"}`}
              >
                <header className="flex flex-wrap justify-between gap-2">
                  <b className="text-base font-black text-white">{version.phase}</b>
                  <span className="text-xs font-bold text-[#86c9f7]">
                    {version.effective_from === "0001-01-01"
                      ? "исходная"
                      : `с ${version.effective_from}`}
                  </span>
                </header>
                <div className="flex flex-wrap justify-between gap-3 text-xs text-[#94a3b7]">
                  <span>
                    База <b>{format(version.base_tdee)}</b>
                  </span>
                  <span>
                    Белок{" "}
                    <b>
                      {format(version.protein_min)}–
                      {format(version.protein_max)}
                    </b>
                  </span>
                  <span>
                    Цель{" "}
                    <b>
                      {Number(version.goal_delta) > 0 ? "+" : ""}
                      {format(version.goal_delta)}
                    </b>
                  </span>
                </div>
                {version.note && <p className="m-0 text-sm leading-relaxed text-[#aab7c8]">{version.note}</p>}
                {version.id === data.active?.id && (
                  <small className="flex items-center gap-1.5 text-xs font-bold text-[#74dfa9]">
                    <Check size={13} /> действует сейчас
                  </small>
                )}
              </article>
            ))}
          </aside>
        </section>
        <section className={`${PANEL_CLASSES} grid gap-4`}>
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="mb-2 text-xs font-black tracking-[0.1em] text-[#69bfff] uppercase">Сохранность данных</p>
              <h2 className="m-0 text-2xl font-black text-white">Резервные копии базы</h2>
              <p className="mt-2 mb-0 max-w-[820px] text-sm leading-relaxed text-[#a9b6c8]">
                Копия хранит рацион, тренировки, замеры и настройки целиком.
                Перед удалением дня приложение создаёт её автоматически.
              </p>
            </div>
            <button
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#5a8ef1]/65 bg-[#5a8ef1]/18 px-5 text-sm font-black text-[#c8e5ff] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#5a8ef1]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
              type="button"
              disabled={backupBusy}
              onClick={createBackup}
            >
              <Download size={17} />
              {backupBusy ? "Создаю…" : "Создать копию"}
            </button>
          </div>
          {backupError && <p className="m-0 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-4 py-3 text-sm text-[#ffb5c8]">{backupError}</p>}
          <div className="grid gap-2">
            {backups.length ? (
              backups.map((backup) => (
                <article className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3" key={backup.filename}>
                  <div className="grid min-w-0 gap-1">
                    <b className="truncate text-sm text-white">{backup.filename}</b>
                    <span className="text-xs text-[#91a0b4]">
                      {new Date(backup.created_at).toLocaleString("ru-RU")} ·{" "}
                      {(backup.size / 1024 / 1024).toFixed(2)} МБ
                    </span>
                  </div>
                  <a className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-sm font-extrabold text-[#dce6f5] no-underline transition-colors hover:border-[#71b9ff]/45 hover:bg-[#42a9ff]/12 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]" href={backup.download_url}>
                    <Download size={15} /> Скачать
                  </a>
                </article>
              ))
            ) : (
              <p className="m-0 grid min-h-[120px] place-content-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-sm text-[#8f9bad]">Резервных копий пока нет.</p>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
