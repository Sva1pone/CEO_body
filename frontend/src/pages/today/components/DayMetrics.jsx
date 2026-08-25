import React, { useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  SlidersHorizontal,
  Target,
} from "lucide-react";

import { api } from "../../../shared/api";
import { format } from "../../../shared/format";
import { InfoTip } from "../../../shared/ui";

const panelClass =
  "overflow-visible rounded-3xl border border-white/10 bg-[#111827]/95 text-[#f6f8fc] shadow-[0_14px_35px_rgba(0,0,0,0.24)]";
const panelHeaderClass =
  "flex items-center justify-between gap-4 px-5 pt-5 text-sm text-[#f6f8fc]";
const fieldLabelClass =
  "grid gap-2 text-xs font-bold leading-relaxed text-[#c4cad5]";
const fieldControlClass =
  "min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2.5 text-sm font-bold text-white outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#7f8999] focus:border-[#71b9ff] focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_rgba(113,185,255,0.14)] focus-visible:outline-none";
const rangeClass =
  "h-5 min-h-0 w-full cursor-pointer border-0 bg-transparent p-0 accent-[#71b9ff]";
const secondaryActionClass =
  "min-h-11 cursor-pointer rounded-xl border border-white/15 bg-white/[0.07] px-4 text-sm font-extrabold text-[#e7ebf2] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/60 hover:bg-[#42a9ff]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] disabled:cursor-default disabled:opacity-50 disabled:active:scale-100";

export function DayDetails({ data, mutate, notify }) {
  const [form, setForm] = useState({
    steps: data.day.steps,
    base_tdee: data.day.base_tdee,
    watch_active_kcal: data.day.watch_active_kcal ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function save(event) {
    event.preventDefault();
    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      mutate(
        await api(`/api/day/${data.day.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        }),
      );
      notify("Расчёт дня обновлён");
    } catch (reason) {
      setError(reason.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={`${panelClass} details-panel activity-panel`}>
      <header className={panelHeaderClass}>
        <span className="flex items-center gap-2.5 font-black">
          <SlidersHorizontal size={20} /> Расход и активность
        </span>
        <small className="text-xs text-[#9fa8b8]">
          Часы заменяют формулу шагов, не суммируются с ней
        </small>
      </header>
      <form className="grid gap-4 px-5 pt-4 pb-5" onSubmit={save}>
        <label className={fieldLabelClass}>
          <span className="flex items-center gap-1.5">
            Шаги{" "}
            <InfoTip text="Если калории часов пустые, расход шагов считается по массе и оценочной дистанции: 0,70 м на шаг. Это чистый расход сверх базового TDEE." />
          </span>
          <input
            className={fieldControlClass}
            type="number"
            step="1"
            value={form.steps}
            onChange={(event) =>
              setForm({ ...form, steps: event.target.value })
            }
          />
          <input
            className={rangeClass}
            type="range"
            min="0"
            max="20000"
            step="250"
            value={Math.min(20000, Number(form.steps) || 0)}
            onChange={(event) =>
              setForm({ ...form, steps: event.target.value })
            }
          />
          <span className="grid grid-cols-5 gap-1.5">
            {[2000, 4000, 6000, 8000, 10000].map((value) => (
              <button
                type="button"
                className="min-h-8 cursor-pointer rounded-full border border-white/15 bg-white/[0.06] px-2 text-xs font-extrabold text-[#c4cad5] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/70 hover:bg-[#71b9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
                key={value}
                onClick={() => setForm({ ...form, steps: value })}
              >
                {value.toLocaleString("ru-RU")}
              </button>
            ))}
          </span>
        </label>
        <label className={fieldLabelClass}>
          <span className="flex items-center gap-1.5">
            Активные ккал с часов{" "}
            <InfoTip text="Необязательное поле. Если заполнить, это число заменит формулу шагов за день. Не вводи сюда общие калории за сутки — только активные." />
          </span>
          <input
            className={fieldControlClass}
            type="number"
            min="0"
            step="1"
            placeholder="Необязательно"
            value={form.watch_active_kcal}
            onChange={(event) =>
              setForm({ ...form, watch_active_kcal: event.target.value })
            }
          />
          <input
            className={rangeClass}
            type="range"
            min="0"
            max="1500"
            step="25"
            value={Math.min(1500, Number(form.watch_active_kcal) || 0)}
            onChange={(event) =>
              setForm({ ...form, watch_active_kcal: event.target.value })
            }
          />
        </label>
        <label className={fieldLabelClass}>
          <span className="flex items-center gap-1.5">
            База TDEE{" "}
            <InfoTip text="Расход почти без шагов и отдельной тренировки." />
          </span>
          <input
            className={fieldControlClass}
            type="number"
            min="500"
            max="10000"
            step="10"
            value={form.base_tdee}
            onChange={(event) =>
              setForm({ ...form, base_tdee: event.target.value })
            }
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-[#aeb7c6]">
          <span>База {format(data.day.base_tdee)}</span>
          <Plus size={14} />
          <span>
            {data.summary.steps_source === "watch" ? "часы" : "шаги"}{" "}
            {format(data.summary.steps_kcal)}
          </span>
          <Plus size={14} />
          <span>зал {format(data.summary.workout_kcal)}</span>
          <b className="ml-auto text-sm text-[#8dcdff] tabular-nums">
            = {format(data.summary.tdee)} ккал
          </b>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className={secondaryActionClass}
            onClick={() => setForm({ ...form, watch_active_kcal: "" })}
          >
            Только формула шагов
          </button>
          <button
            className={secondaryActionClass}
            disabled={busy || Boolean(data.day.closed_at)}
          >
            {data.day.closed_at
              ? "День закрыт"
              : busy
                ? "Сохраняю…"
                : "Сохранить активность"}
          </button>
        </div>
        {error && <p className="m-0 text-sm text-[#ffb5c8]">{error}</p>}
      </form>
    </section>
  );
}

function sleepDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 1440;
  return minutes;
}

function formatDuration(minutes) {
  return minutes == null
    ? "время рассчитается автоматически"
    : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function timeToMinutes(value) {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const safe = Math.max(0, Math.min(1439, Number(value) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function SleepPanel({ data, mutate, notify }) {
  const source = data.sleep || {};
  const [form, setForm] = useState({
    start: source.start || "",
    end: source.end || "",
    deep_percent: source.deep_percent ?? "",
    rem_percent: source.rem_percent ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const duration = sleepDuration(form.start, form.end);
  async function save(event) {
    event.preventDefault();
    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      mutate(
        await api(`/api/day/${data.day.id}/sleep`, {
          method: "PATCH",
          body: JSON.stringify(form),
        }),
      );
      notify("Сон сохранён");
    } catch (reason) {
      setError(reason.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function clear() {
    if (submitting.current) return;

    const empty = { start: "", end: "", deep_percent: "", rem_percent: "" };
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      mutate(
        await api(`/api/day/${data.day.id}/sleep`, {
          method: "PATCH",
          body: JSON.stringify(empty),
        }),
      );
      setForm(empty);
      notify("Данные сна оставлены пустыми");
    } catch (reason) {
      setError(reason.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={panelClass}>
      <header className={panelHeaderClass}>
        <span className="flex items-center gap-2.5 font-black">
          <Clock3 size={20} /> Сон
        </span>
        <small className="text-xs text-[#9fa8b8]">
          Не надевал часы — оставь поля пустыми
        </small>
      </header>
      <form className="grid gap-4 px-5 pt-4 pb-5" onSubmit={save}>
        <label className={fieldLabelClass}>
          Засыпание
          <input
            className={fieldControlClass}
            type="time"
            value={form.start}
            onChange={(event) =>
              setForm({ ...form, start: event.target.value })
            }
          />
          <input
            className={rangeClass}
            type="range"
            min="0"
            max="1439"
            step="15"
            value={timeToMinutes(form.start)}
            onChange={(event) =>
              setForm({ ...form, start: minutesToTime(event.target.value) })
            }
          />
        </label>
        <label className={fieldLabelClass}>
          Подъём
          <input
            className={fieldControlClass}
            type="time"
            value={form.end}
            onChange={(event) => setForm({ ...form, end: event.target.value })}
          />
          <input
            className={rangeClass}
            type="range"
            min="0"
            max="1439"
            step="15"
            value={timeToMinutes(form.end)}
            onChange={(event) =>
              setForm({ ...form, end: minutesToTime(event.target.value) })
            }
          />
        </label>
        <label className={fieldLabelClass}>
          SWS, %
          <input
            className={fieldControlClass}
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.deep_percent}
            onChange={(event) =>
              setForm({ ...form, deep_percent: event.target.value })
            }
          />
          <input
            className={rangeClass}
            type="range"
            min="0"
            max="100"
            step="1"
            value={Number(form.deep_percent) || 0}
            onChange={(event) =>
              setForm({ ...form, deep_percent: event.target.value })
            }
          />
        </label>
        <label className={fieldLabelClass}>
          REM, %
          <input
            className={fieldControlClass}
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.rem_percent}
            onChange={(event) =>
              setForm({ ...form, rem_percent: event.target.value })
            }
          />
          <input
            className={rangeClass}
            type="range"
            min="0"
            max="100"
            step="1"
            value={Number(form.rem_percent) || 0}
            onChange={(event) =>
              setForm({ ...form, rem_percent: event.target.value })
            }
          />
        </label>
        <div className="grid gap-1 rounded-[13px] border border-[#4ab1ee]/20 bg-[#2b9fe8]/10 px-[13px] py-2.5">
          <small className="text-xs text-[#9fa8b8]">Длительность сна</small>
          <b className="text-sm text-white tabular-nums">
            {formatDuration(duration)}
          </b>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className={secondaryActionClass}
            onClick={clear}
          >
            Нет данных с часов
          </button>
          <button className={secondaryActionClass} disabled={busy}>
            {busy ? "Сохраняю…" : "Сохранить сон"}
          </button>
        </div>
        {error && <p className="m-0 text-sm text-[#ffb5c8]">{error}</p>}
      </form>
    </section>
  );
}

export function DateNavigator({ date }) {
  const controlClass =
    "grid min-h-[42px] min-w-[42px] cursor-pointer place-items-center rounded-[13px] border border-white/[0.13] bg-[#0f1422]/[0.88] px-[11px] text-[#eef1fa] transition hover:border-white/25 hover:bg-[#151c2e]";
  const go = (next) => {
    if (next) location.href = `/?date=${next}`;
  };
  const shift = (delta) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + delta);
    go(next.toLocaleDateString("en-CA"));
  };
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <nav
      className="date-navigator mx-auto mt-[-16px] mb-[18px] flex items-center justify-center gap-2"
      aria-label="Выбор дня"
    >
      <button
        className={controlClass}
        onClick={() => shift(-1)}
        aria-label="Предыдущий день"
      >
        <ChevronLeft />
      </button>
      <label className="flex min-h-[42px] items-center gap-[9px] rounded-[13px] border border-white/[0.13] bg-[#0f1422]/[0.88] px-3 text-[#eef1fa]">
        <CalendarDays size={18} />
        <input
          className="w-[142px] border-0 bg-transparent p-0 font-extrabold text-white [color-scheme:dark]"
          type="date"
          value={date}
          onChange={(event) => go(event.target.value)}
        />
      </label>
      <button
        className={controlClass}
        onClick={() => shift(1)}
        aria-label="Следующий день"
      >
        <ChevronRight />
      </button>
      {date !== today && (
        <button
          className={`${controlClass} px-[15px] font-extrabold text-[#8fd5ff]`}
          onClick={() => go(today)}
        >
          Сегодня
        </button>
      )}
    </nav>
  );
}
