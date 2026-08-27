import React from "react";
import { CalendarClock, ChevronDown, Ruler } from "lucide-react";

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

function dayCountText(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} день`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14))
    return `${count} дня`;
  return `${count} дней`;
}

function DayLink({ day }) {
  return (
    <a
      className="group flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-white/[0.045] px-3.5 py-2.5 text-sm no-underline transition-[transform,background-color] hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
      href={`/?date=${day.log_date}`}
    >
      <span className="text-[#c7d2e1]">
        <b className="text-white">{formatDate(day.log_date)}</b> · день заполнен, но не закрыт
      </span>
      <span className="font-black text-[#8bd5ff] group-hover:text-white">Открыть день</span>
    </a>
  );
}

export default function ReminderCenter({ reminders }) {
  if (!reminders?.active_reminders) return null;

  const days = reminders.unclosed_days.items;
  const previewDays = days.slice(0, 3);
  const remainingDays = days.slice(3);
  const measurement = reminders.measurement;

  return (
    <section className="mb-[22px] grid gap-3" aria-labelledby="attention-title">
      <h2 className="m-0 text-sm font-black tracking-[0.12em] text-[#f1c96b] uppercase" id="attention-title">
        Требует внимания
      </h2>
      <div className="grid gap-3 xl:grid-cols-2">
        {days.length > 0 && (
          <article className="grid content-start gap-3 rounded-[20px] border border-[#f0b94e]/25 bg-[linear-gradient(145deg,rgba(53,40,22,0.9),rgba(18,24,36,0.96))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.2)] sm:p-5">
            <header className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f0b94e]/12 text-[#f4cf7a]" aria-hidden="true">
                <CalendarClock size={22} strokeWidth={2} />
              </span>
              <div>
                <h3 className="m-0 text-lg font-black text-white">Осталось закрыть {dayCountText(days.length)}</h3>
                <p className="mt-1 mb-0 text-xs leading-relaxed text-[#aeb8c8]">Проверь записи и закрой каждый день вручную.</p>
              </div>
            </header>
            <div className="grid gap-2">
              {previewDays.map((day) => <DayLink day={day} key={day.id} />)}
            </div>
            {remainingDays.length > 0 && (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-black text-[#f4cf7a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0b94e]">
                  Ещё {remainingDays.length}
                  <ChevronDown className="transition-transform group-open:rotate-180" size={19} aria-hidden="true" />
                </summary>
                <div className="mt-2 grid gap-2">
                  {remainingDays.map((day) => <DayLink day={day} key={day.id} />)}
                </div>
              </details>
            )}
          </article>
        )}

        {measurement.overdue && (
          <article className="grid content-start gap-4 rounded-[20px] border border-[#68bfff]/25 bg-[linear-gradient(145deg,rgba(18,44,65,0.9),rgba(14,22,35,0.96))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.2)] sm:p-5">
            <header className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#68bfff]/12 text-[#8bd5ff]" aria-hidden="true">
                <Ruler size={22} strokeWidth={2} />
              </span>
              <div>
                <h3 className="m-0 text-lg font-black text-white">Пора обновить замеры тела</h3>
                <p className="mt-1 mb-0 text-sm leading-relaxed text-[#b7c5d7]">
                  {measurement.last_tape_date
                    ? `Замеры тела не обновлялись ${dayCountText(measurement.elapsed_days)}.`
                    : `С начала стратегии прошло ${dayCountText(measurement.elapsed_days)} без замеров тела.`}
                </p>
                {measurement.last_tape_date && (
                  <p className="mt-1 mb-0 text-xs text-[#8fa1b7]">Последний замер: {formatDate(measurement.last_tape_date)}</p>
                )}
              </div>
            </header>
            <a
              className="inline-flex min-h-11 w-max items-center justify-center rounded-xl border border-[#68bfff]/35 bg-[#68bfff]/12 px-4 text-sm font-black text-[#bfe6ff] no-underline transition-[transform,background-color] hover:bg-[#68bfff]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
              href="/progress?action=add-tape"
            >
              Добавить замеры
            </a>
          </article>
        )}
      </div>
    </section>
  );
}
