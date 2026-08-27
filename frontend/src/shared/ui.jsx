import React from "react";
import {
  Activity,
  BarChart3,
  Dumbbell,
  FileText,
  Flame,
  HelpCircle,
  Home,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Zap,
} from "lucide-react";

import { ICONS } from "./constants";
import { useReminders } from "./reminders";

function NavigationReminder({ itemKey, reminders, mobile = false }) {
  if (itemKey === "today" && reminders?.unclosed_days.count > 0) {
    const count = reminders.unclosed_days.count;
    return (
      <span
        className={`${mobile ? "absolute -top-2 -right-3 min-w-5 px-1 text-[9px]" : "ml-auto min-w-6 px-1.5 text-[10px]"} grid h-5 place-items-center rounded-full bg-[#f0b94e] font-black leading-none text-[#1d170b] shadow-[0_0_0_2px_#152031]`}
        aria-label={`Незакрытых дней: ${count}`}
      >
        {count}
      </span>
    );
  }
  if (itemKey === "progress" && reminders?.measurement.overdue) {
    return (
      <span
        className={`${mobile ? "absolute -top-1 -right-2" : "ml-auto"} size-2.5 rounded-full bg-[#68bfff] shadow-[0_0_10px_rgba(104,191,255,0.8)]`}
        aria-label="Просрочены замеры тела"
      />
    );
  }
  return null;
}

export function CategoryIcon({ product, size = 22, className = "size-25 rounded-xl" }) {
  const Icon = ICONS[product.category_icon] || Utensils;
  if (product.image_url)
    return (
      <span
        data-testid="category-icon"
        className={`${className} relative shrink-0 overflow-hidden`}
        aria-hidden="true"
      >
        <img
          className="absolute inset-0 size-full object-cover [filter:saturate(.92)_contrast(.98)_brightness(.98)]"
          src={product.image_url}
          alt=""
          style={{
            objectPosition: `${product.image_position_x ?? 50}% ${product.image_position_y ?? 50}%`,
            transform: `scale(${product.image_scale ?? 1})`,
          }}
        />
      </span>
    );
  return (
    <span
      data-testid="category-icon"
      className={`grid shrink-0 place-items-center border bg-[color-mix(in_srgb,var(--category)_12%,white)] text-[var(--category)] ${className}`}
      style={{
        "--category": product.category_color || "#6d5dfc",
        borderColor: `color-mix(in srgb, ${product.category_color || "#6d5dfc"} 25%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Icon size={size} strokeWidth={1.8} />
    </span>
  );
}

export function InfoTip({ text }) {
  return (
    <span
      className="group relative inline-grid cursor-help place-items-center text-[#a29ead] outline-none"
      tabIndex="0"
      aria-label={text}
    >
      <HelpCircle size={32} />
      <span className="invisible absolute right-[-8px] bottom-[calc(100%+10px)] z-80 w-[250px] translate-y-[5px] rounded-[11px] bg-[#242033] px-[13px] py-[11px] text-xs leading-6 text-white opacity-0 shadow-[0_12px_28px_rgba(24,20,40,0.25)] transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus:visible group-focus:translate-y-0 group-focus:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function CinematicHeroArt({ className = "" }) {
  return (
    <>
      <div
        className="cinematic-hero-backdrop"
        style={{
          backgroundImage:
            "radial-gradient(circle at 72% 25%, color-mix(in srgb, var(--hero-accent) 28%, transparent), transparent 34%), linear-gradient(135deg, rgba(38,53,82,0.72), rgba(8,13,23,0.2))",
        }}
        aria-hidden="true"
      />
      <div
        className={`cinematic-hero-art ${className}`}
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 72% 48%, color-mix(in srgb, var(--hero-accent) 45%, transparent), transparent 32%), linear-gradient(115deg, transparent 45%, rgba(255,255,255,0.08) 46%, transparent 62%)",
        }}
        aria-hidden="true"
      />
    </>
  );
}

export function Shell({ children, active, cinematic = false }) {
  const { reminders } = useReminders();
  const links = [
    ["/", "Сегодня", Home, "today"],
    ["/exercises", "Упражнения", Dumbbell, "exercises"],
    ["/progress", "Прогресс", BarChart3, "progress"],
    ["/statistics", "Статистика", Activity, "statistics"],
    ["/weight-trend", "Вес и баланс", Scale, "weight-trend"],
    ["/settings", "Стратегия", SlidersHorizontal, "settings"],
    ["/report", "Отчёт", FileText, "report"],
  ];
  const desktopLinkTone = cinematic
    ? "text-[#aeb3c0] hover:bg-white/[0.07] hover:text-white"
    : "text-[var(--muted)] hover:bg-[#f5f3fb] hover:text-[var(--ink)]";
  const desktopActiveTone = cinematic
    ? "bg-[rgba(99,142,255,0.18)] text-white"
    : "bg-[var(--violet-soft)] text-[var(--violet-dark)] shadow-[inset_0_0_0_1px_rgba(109,93,252,0.08)]";
  const mobileLinkTone = cinematic
    ? "text-[#8f99aa]"
    : "text-[var(--muted)]";
  const mobileActiveTone = cinematic
    ? "bg-[rgba(66,169,255,0.15)] text-[#d9efff]"
    : "bg-[var(--violet-soft)] text-[var(--violet)]";

  return (
    <div
      className={`app-shell min-h-screen ${
        cinematic
          ? "cinematic bg-[radial-gradient(circle_at_80%_0%,rgba(66,169,255,0.2),transparent_35rem),linear-gradient(125deg,#111a27,#172337_56%,#101927)]"
          : ""
      }`}
    >
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-30 flex w-[230px] flex-col border-r px-[18px] py-7 backdrop-blur-[22px] max-[1100px]:w-[190px] max-[760px]:hidden ${
          cinematic
            ? "border-white/[0.1] bg-[#152031]/95"
            : "border-[#e0dceb]/85 bg-white/[0.88]"
        }`}
      >
        <a
          className={`logo flex items-center gap-[11px] px-[10px] pb-[30px] text-xl font-extrabold no-underline ${cinematic ? "text-white" : "text-[var(--ink)]"}`}
          href="/"
        >
          <span className="logo-mark grid size-[38px] place-items-center rounded-[13px] bg-[linear-gradient(145deg,#887bff,#5948ed)] text-white shadow-[0_8px_25px_rgba(109,93,252,0.34)]">
            <Sparkles size={20} />
          </span>
          <span>
            СЕО <b className="text-[var(--violet)]">тела</b>
          </span>
        </a>
        <nav className="grid gap-[7px]">
          {links.map(([href, label, Icon, key]) => (
            <a
              key={href}
              href={href}
              className={`flex items-center gap-[13px] rounded-[13px] px-[13px] py-3 font-semibold no-underline transition duration-200 ease-out hover:translate-x-0.5 ${desktopLinkTone} ${active === key ? desktopActiveTone : ""}`}
            >
              <Icon size={26} strokeWidth={1.8} />
              <span>{label}</span>
              <NavigationReminder itemKey={key} reminders={reminders} />
            </a>
          ))}
        </nav>
        <div
          className={`sidebar-note mt-auto flex items-start gap-2.5 rounded-[14px] p-3.5 text-[11px] leading-6 ${
            cinematic
              ? "bg-white/[0.06] text-[#aeb3c0]"
              : "bg-[#f4f2fa] text-[var(--muted)]"
          }`}
        >
          <Zap className="shrink-0 text-[var(--violet)]" size={18} />
          <span>Данные хранятся только на этом компьютере</span>
        </div>
      </aside>
      <main
        className={`app-main box-border ml-[230px] w-[calc(100%-230px)] max-w-none px-[clamp(28px,4vw,68px)] pt-11 pb-[90px] max-[1100px]:ml-[190px] max-[1100px]:w-[calc(100%-190px)] max-[1100px]:px-[25px] max-[760px]:ml-0 max-[760px]:w-full max-[760px]:px-[15px] max-[760px]:pt-[25px] max-[760px]:pb-[100px] ${
          cinematic
            ? "relative bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px] text-[#f2f2f7]"
            : ""
        }`}
      >
        {children}
      </main>
      <nav
        className={`mobile-nav fixed right-3 bottom-2.5 left-3 z-[90] hidden grid-cols-4 rounded-[18px] border p-[7px] backdrop-blur-[20px] max-[760px]:grid ${
          cinematic
            ? "border-white/[0.11] bg-[#090e18]/[0.92] shadow-[0_17px_50px_rgba(0,0,0,0.48)]"
            : "border-[#e2deed]/[0.88] bg-white/[0.92] shadow-[0_15px_50px_rgba(44,35,81,0.2)]"
        }`}
      >
        {links.map(([href, label, Icon, key]) => (
          <a
            key={href}
            href={href}
            className={`grid justify-items-center gap-[3px] rounded-[11px] p-[7px] text-[8px] font-bold no-underline ${mobileLinkTone} ${active === key ? mobileActiveTone : ""}`}
          >
            <span className="relative">
              <Icon size={20} />
              <NavigationReminder itemKey={key} reminders={reminders} mobile />
            </span>
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading-screen grid min-h-[70vh] place-content-center justify-items-center gap-3 text-center">
      <span className="loader-orbit grid size-[68px] animate-spin place-items-center rounded-full border-2 border-[#ddd7ff] border-t-[var(--violet)] text-[var(--violet)]">
        <Sparkles className="animate-[spin_1.2s_linear_infinite_reverse]" />
      </span>
      <b>Собираю твой день…</b>
    </div>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <div className="error-card grid min-h-[70vh] place-content-center justify-items-center gap-3 text-center">
      <Flame size={28} />
      <h2>Экран не загрузился</h2>
      <p className="text-[var(--muted)]">{error}</p>
      <button
        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[13px] border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96]"
        onClick={retry}
      >
        Попробовать ещё раз
      </button>
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  tone = "violet",
  large = false,
  appearance = "dashboard",
}) {
  if (appearance === "cinematic") {
    const toneClasses = {
      violet: "text-[#a99fff]",
      pink: "text-[#ff8fbd]",
      cyan: "text-[#79d8f4]",
    };

    return (
      <article className="grid min-h-[140px] gap-2 rounded-[20px] border border-white/10 bg-[linear-gradient(145deg,rgba(25,31,48,0.96),rgba(12,17,28,0.96))] p-5 text-white shadow-[0_15px_38px_rgba(0,0,0,0.23)]">
        <div className="flex items-center justify-between gap-3 text-sm text-[#9da7b8]">
          <span className="flex items-center gap-2">
            <Icon className={toneClasses[tone] ?? toneClasses.violet} size={19} />
            {label}
          </span>
          {hint && <InfoTip text={hint} />}
        </div>
        <strong className={`tracking-[-0.045em] tabular-nums ${large ? "text-4xl" : "text-3xl"}`}>
          {value}
        </strong>
        <small className="self-end text-xs text-[#9da7b8]">{suffix}</small>
      </article>
    );
  }

  if (appearance === "dashboard") {
    const toneClasses = {
      violet:
        "after:bg-[var(--violet)] after:shadow-[0_0_17px_rgba(109,93,252,0.45)]",
      pink: "after:bg-[var(--pink)] after:shadow-[0_0_17px_rgba(240,95,151,0.42)]",
      cyan: "after:bg-[var(--cyan)] after:shadow-[0_0_17px_rgba(32,168,208,0.42)]",
    };

    return (
      <article
        className={`relative flex min-h-[138px] flex-col rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--ink)] shadow-[var(--shadow)] after:mt-auto after:h-1 after:w-[70px] after:rounded-full ${toneClasses[tone] ?? toneClasses.violet}`}
      >
        <div className="flex justify-between text-[13px] text-[var(--muted)]">
          <span className="flex items-center gap-[7px]">
            <Icon size={18} />
            {label}
          </span>
          {hint && <InfoTip text={hint} />}
        </div>
        <strong
          className={`mt-3 mb-0.5 block tracking-[-0.045em] ${
            large
              ? "text-[39px] text-[var(--violet-dark)]"
              : "text-[31px]"
          }`}
        >
          {value}
        </strong>
        <small className="text-[var(--muted)]">{suffix}</small>
      </article>
    );
  }

  return null;
}
