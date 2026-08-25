import React, { useEffect, useRef, useState } from "react";
import {
  Archive,
  Check,
  FolderPlus,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  X,
  Zap,
} from "lucide-react";

import { api } from "../../../shared/api";
import { ICONS } from "../../../shared/constants";
import { format } from "../../../shared/format";
import { CategoryIcon, InfoTip } from "../../../shared/ui";
import {
  CategoryDialog,
  ProductForm,
} from "../../products/ProductsPage";

const MODAL_BACKDROP_CLASSES =
  "fixed inset-0 z-100 grid place-items-center bg-[#02060c]/80 p-6 backdrop-blur-xl animate-[fadeIn_180ms_ease_both] motion-reduce:animate-none";
const PRODUCT_DIALOG_CLASSES =
  "relative max-h-[calc(100vh-48px)] w-full max-w-[560px] overflow-y-auto rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] p-7 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)] animate-[modalIn_280ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none";
const CLOSE_BUTTON_CLASSES =
  "absolute top-5 right-5 z-10 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color,border-color] hover:border-[#71b9ff]/45 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]";
const MODE_BUTTON_BASE_CLASSES =
  "min-h-11 cursor-pointer rounded-[10px] border border-transparent px-3 text-sm font-extrabold transition-[transform,background-color,color,border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]";
const QUANTITY_BUTTON_CLASSES =
  "grid min-h-[72px] cursor-pointer place-items-center rounded-2xl border border-white/12 bg-white/[0.06] text-[#8dcdff] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/55 hover:bg-[#42a9ff]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]";
const PRIMARY_ACTION_CLASSES =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96] disabled:cursor-default disabled:opacity-45 disabled:hover:translate-y-0 disabled:active:scale-100";
const ERROR_MESSAGE_CLASSES =
  "my-3 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-3 py-2.5 text-sm leading-relaxed text-[#ffb5c8]";

function useEscapeToClose(onClose, disabled = false) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !disabled) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose]);
}

function ProductCard({
  product,
  onPick,
  onEdit,
  onDragStart,
  recommended = false,
  ActionIcon = Pencil,
  actionLabel = "Изменить",
}) {
  return (
    <article
      draggable={Boolean(onDragStart)}
      onDragStart={(event) => onDragStart?.(event, product)}
      className={`group relative flex min-h-[105px] min-w-0 cursor-pointer items-start gap-2.5 overflow-hidden rounded-2xl border bg-[#2c405c] p-2 text-left transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[rgba(113,185,255,0.48)] hover:bg-[#334b6b] hover:shadow-[0_12px_30px_rgba(0,0,0,0.22)] ${
        recommended
          ? "border-[#e8bf54] shadow-[inset_0_0_0_1px_rgba(232,191,84,0.2)]"
          : "border-[#141E2C]"
      }`}
    >
      <CategoryIcon product={product} size="25" />
      <button
        type="button"
        className={`min-w-0 flex-1 border-0 bg-transparent p-0 pr-[57px] text-left text-inherit ${onPick ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => onPick?.(product)}
        disabled={!onPick}
      >
        <span className="block min-w-0">
          <b className="line-clamp-2 text-[18px] leading-[1.65]">{product.name}</b>
          <small className="my-[3px] block overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-[var(--muted)]">
            {product.brand || product.serving_label}
          </small>
          <span
            className="inline-block max-w-full rounded-full px-[12px] py-1 text-[10px] font-extrabold tracking-[0.135em] text-ellipsis whitespace-nowrap uppercase"
            style={{
              background: `color-mix(in srgb, ${product.benefit_color} 20%, white)`,
              color: `color-mix(in srgb, ${product.benefit_color} 80%, #241f37)`,
            }}
          >
            {product.benefit_tag}
          </span>
        </span>
      </button>
      {recommended && (
        <span className="absolute right-[7px] bottom-[7px] flex items-center gap-[3px] rounded-full bg-[#f2bd32] px-1.5 py-[3px] text-[8px] font-black tracking-[0.03em] text-[#18140b] uppercase">
          <Sparkles size={12} /> подходит
        </span>
      )}
      <span className="absolute top-3 right-[11px] grid justify-items-end text-[var(--violet-dark)]">
        <b className="text-[18px]">{format(product.kcal, 1)}</b>
        <small className="text-[15px] text-[var(--muted)]">ккал</small>
      </span>
      <button
        type="button"
        className="absolute right-2.5 bottom-2.5 z-10 grid size-8 cursor-pointer place-items-center rounded-lg border border-white/12 bg-[#17263a] text-[#c7d4e5] transition-[transform,background-color,border-color,color] hover:border-[#71b9ff]/55 hover:bg-[#294564] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
        onClick={() => onEdit(product)}
        aria-label={`${actionLabel} ${product.name}`}
      >
        <ActionIcon size={14} />
      </button>
    </article>
  );
}

export function ProductPicker({ product, meal, onClose, onAdded }) {
  const [mode, setMode] = useState("serving");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const requestToken = useRef(
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  );
  useEscapeToClose(onClose, busy);
  if (!product) return null;
  const modes = [
    { id: "serving", label: "Порции", available: true },
    { id: "grams", label: "Граммы", available: Boolean(product.serving_grams) },
    {
      id: "units",
      label: "Штуки",
      available: product.unit_name && product.unit_name !== "порция",
    },
  ].filter((item) => item.available);
  const factor =
    mode === "grams"
      ? quantity / product.serving_grams
      : mode === "units"
        ? quantity / Math.max(product.serving_units || 1, 1)
        : quantity;
  const step = mode === "grams" ? 5 : 1;
  function changeMode(next) {
    setMode(next);
    setQuantity(next === "grams" ? Number(product.serving_grams) : 1);
  }
  async function add() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onAdded(product, quantity, mode, requestToken.current);
      onClose();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <div
      className={MODAL_BACKDROP_CLASSES}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={PRODUCT_DIALOG_CLASSES}
        role="dialog"
        aria-modal="true"
        aria-label={`Добавить ${product.name}`}
      >
        <button
          className={CLOSE_BUTTON_CLASSES}
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X />
        </button>
        <div className="flex items-start gap-4 pr-14">
          <CategoryIcon
            product={product}
            size={34}
            className="size-[70px] rounded-[20px]"
          />
          <div className="min-w-0">
            <span
              className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-[0.05em] uppercase"
              style={{
                borderColor: `color-mix(in srgb, ${product.benefit_color} 45%, transparent)`,
                background: `color-mix(in srgb, ${product.benefit_color} 16%, transparent)`,
                color: `color-mix(in srgb, ${product.benefit_color} 75%, white)`,
              }}
            >
              {product.benefit_tag}
            </span>
            <h2 className="mt-3 mb-1.5 text-2xl leading-tight font-black tracking-[-0.03em] text-balance">
              {product.name}
            </h2>
            <p className="m-0 text-sm leading-relaxed text-[#aeb7c6]">
              {product.brand || product.category} · стандарт:{" "}
              {product.serving_label}
            </p>
          </div>
        </div>
        <div className="my-6 grid grid-flow-col auto-cols-fr gap-1.5 rounded-[14px] bg-white/[0.06] p-1.5">
          {modes.map((item) => (
            <button
              key={item.id}
              className={`${MODE_BUTTON_BASE_CLASSES} ${
                mode === item.id
                  ? "border-white/15 bg-[#2c405c] text-white shadow-[0_7px_18px_rgba(0,0,0,0.24)]"
                  : "text-[#aeb7c6] hover:bg-white/[0.07] hover:text-white"
              }`}
              type="button"
              onClick={() => changeMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[58px_minmax(0,1fr)_58px] items-stretch gap-3">
          <button
            className={QUANTITY_BUTTON_CLASSES}
            type="button"
            onClick={() => setQuantity((value) => Math.max(step, value - step))}
            aria-label="Уменьшить"
          >
            <Minus />
          </button>
          <label className="relative">
            <input
              className="h-[72px] w-full rounded-2xl border border-white/12 bg-white/[0.06] px-14 text-center text-3xl font-black tabular-nums text-white outline-none transition-[border-color,box-shadow,background-color] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]"
              type="number"
              min={step}
              step={step}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(step, Number(event.target.value) || step))
              }
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-[#98a3b5]">
              {mode === "grams"
                ? "г"
                : mode === "units"
                  ? "шт."
                  : quantity === 1
                    ? "порция"
                    : "порции"}
            </span>
          </label>
          <button
            className={QUANTITY_BUTTON_CLASSES}
            type="button"
            onClick={() => setQuantity((value) => value + step)}
            aria-label="Увеличить"
          >
            <Plus />
          </button>
        </div>
        <div className="my-4 grid grid-cols-3 gap-2.5">
          <span className="rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-3 text-center text-xs text-[#9da8b8]">
            <b className="mb-1 block text-lg font-black tabular-nums text-white">{format(product.kcal * factor, 1)}</b> ккал
          </span>
          <span className="rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-3 text-center text-xs text-[#9da8b8]">
            <b className="mb-1 block text-lg font-black tabular-nums text-white">{format(product.protein * factor, 1)}</b> г белка
          </span>
          <span className="rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-3 text-center text-xs text-[#9da8b8]">
            <b className="mb-1 block text-lg font-black tabular-nums text-white">{format((product.carbs || 0) * factor, 1)}</b> г углеводов
          </span>
        </div>
        {product.package_units && (
          <p className="my-3 text-center text-xs text-[#9da8b8]">
            В упаковке: {format(product.package_units, 1)} шт.
          </p>
        )}
        {error && <p className={ERROR_MESSAGE_CLASSES}>{error}</p>}
        <button
          className={`${PRIMARY_ACTION_CLASSES} w-full`}
          type="button"
          disabled={busy}
          onClick={add}
        >
          {busy ? "Добавляю…" : `Добавить в ${meal.toLowerCase()}`}{" "}
          <Plus size={19} />
        </button>
      </section>
    </div>
  );
}

export function EntryEditor({ entry, meals, onClose, onSaved, onDeleted }) {
  const [mode, setMode] = useState(entry.quantity_mode);
  const [quantity, setQuantity] = useState(entry.quantity);
  const [meal, setMeal] = useState(entry.meal_type);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscapeToClose(onClose, busy);
  const modes = [
    { id: "serving", label: "Порции", available: true },
    { id: "grams", label: "Граммы", available: Boolean(entry.serving_grams) },
    {
      id: "units",
      label: "Штуки",
      available: entry.unit_name && entry.unit_name !== "порция",
    },
  ].filter((item) => item.available);
  const factor =
    mode === "grams"
      ? quantity / entry.serving_grams
      : mode === "units"
        ? quantity / Math.max(entry.serving_units || 1, 1)
        : quantity;
  const baseKcal =
    entry.kcal /
    Math.max(
      entry.quantity_mode === "grams"
        ? entry.quantity / (entry.serving_grams || 1)
        : entry.quantity_mode === "units"
          ? entry.quantity / Math.max(entry.serving_units || 1, 1)
          : entry.quantity,
      0.0001,
    );
  const step = mode === "grams" ? 5 : 1;
  function switchMode(next) {
    setMode(next);
    setQuantity(next === "grams" ? entry.serving_grams : 1);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSaved(entry, quantity, mode, meal);
      onClose();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm(`Удалить «${entry.product_name}» из дневника?`)) return;
    setBusy(true);
    try {
      await onDeleted(entry.id);
      onClose();
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }
  return (
    <div
      className={MODAL_BACKDROP_CLASSES}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={PRODUCT_DIALOG_CLASSES}
        role="dialog"
        aria-modal="true"
        aria-label={`Изменить ${entry.product_name}`}
      >
        <button
          className={CLOSE_BUTTON_CLASSES}
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X />
        </button>
        <div className="flex items-start gap-4 pr-14">
          <CategoryIcon
            product={entry}
            size={34}
            className="size-[70px] rounded-[20px]"
          />
          <div className="min-w-0">
            <span
              className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-[0.05em] uppercase"
              style={{
                borderColor: `color-mix(in srgb, ${entry.benefit_color} 45%, transparent)`,
                background: `color-mix(in srgb, ${entry.benefit_color} 16%, transparent)`,
                color: `color-mix(in srgb, ${entry.benefit_color} 75%, white)`,
              }}
            >
              {entry.benefit_tag}
            </span>
            <h2 className="mt-3 mb-1.5 text-2xl leading-tight font-black tracking-[-0.03em] text-balance">
              {entry.product_name}
            </h2>
            <p className="m-0 text-sm leading-relaxed text-[#aeb7c6]">
              Меняй сектор без повторного добавления продукта.
            </p>
          </div>
        </div>
        <label className="mt-5 grid gap-2 text-sm font-extrabold text-[#c7cfdb]">
          Приём пищи
          <select
            className="min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]"
            value={meal}
            onChange={(event) => setMeal(event.target.value)}
          >
            {meals.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="my-5 grid grid-flow-col auto-cols-fr gap-1.5 rounded-[14px] bg-white/[0.06] p-1.5">
          {modes.map((item) => (
            <button
              key={item.id}
              className={`${MODE_BUTTON_BASE_CLASSES} ${
                mode === item.id
                  ? "border-white/15 bg-[#2c405c] text-white shadow-[0_7px_18px_rgba(0,0,0,0.24)]"
                  : "text-[#aeb7c6] hover:bg-white/[0.07] hover:text-white"
              }`}
              type="button"
              onClick={() => switchMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[58px_minmax(0,1fr)_58px] items-stretch gap-3">
          <button
            className={QUANTITY_BUTTON_CLASSES}
            type="button"
            onClick={() => setQuantity((value) => Math.max(step, value - step))}
            aria-label="Уменьшить"
          >
            <Minus />
          </button>
          <label className="relative">
            <input
              className="h-[72px] w-full rounded-2xl border border-white/12 bg-white/[0.06] px-14 text-center text-3xl font-black tabular-nums text-white outline-none transition-[border-color,box-shadow,background-color] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]"
              type="number"
              min={step}
              step={step}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(step, Number(event.target.value) || step))
              }
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-bold text-[#98a3b5]">
              {mode === "grams"
                ? "г"
                : mode === "units"
                  ? "шт."
                  : quantity === 1
                    ? "порция"
                    : "порции"}
            </span>
          </label>
          <button
            className={QUANTITY_BUTTON_CLASSES}
            type="button"
            onClick={() => setQuantity((value) => value + step)}
            aria-label="Увеличить"
          >
            <Plus />
          </button>
        </div>
        <div className="my-4 grid grid-cols-3 gap-2.5">
          <span className="rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-3 text-center text-xs text-[#9da8b8]">
            <b className="mb-1 block text-lg font-black tabular-nums text-white">{format(baseKcal * factor, 1)}</b> ккал
          </span>
          <span className="rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-3 text-center text-xs text-[#9da8b8]">
            <b className="mb-1 block text-lg font-black tabular-nums text-white">
              {format(
                (entry.protein / Math.max(entry.kcal, 1)) * baseKcal * factor,
                1,
              )}
            </b>{" "}
            г белка
          </span>
          <span className="rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-3 text-center text-xs text-[#9da8b8]">
            <b className="mb-1 block text-lg font-black tabular-nums text-white">
              {format(
                (entry.carbs / Math.max(entry.kcal, 1)) * baseKcal * factor,
                1,
              )}
            </b>{" "}
            г углеводов
          </span>
        </div>
        {error && <p className={ERROR_MESSAGE_CLASSES}>{error}</p>}
        <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2.5">
          <button
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[#ff7699]/35 bg-[#ff7699]/10 px-4 text-sm font-extrabold text-[#ff9ab4] transition-[transform,background-color,border-color] hover:border-[#ff7699]/60 hover:bg-[#ff7699]/18 hover:text-[#ffc0d0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7699] active:scale-[0.96] disabled:cursor-default disabled:opacity-45"
            type="button"
            disabled={busy}
            onClick={remove}
          >
            <Trash2 size={18} /> Удалить
          </button>
          <button
            className={PRIMARY_ACTION_CLASSES}
            type="button"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Сохраняю…" : "Сохранить"} <Check size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}

function TempProductDialog({ data, onClose, onSaved }) {
  const [basis, setBasis] = useState("serving");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscapeToClose(onClose, busy);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      await api(`/api/day/${data.day.id}/temp-food`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      await onSaved();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={MODAL_BACKDROP_CLASSES} onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className={PRODUCT_DIALOG_CLASSES} role="dialog" aria-labelledby="temp-product-title" onSubmit={submit}>
        <button type="button" className={CLOSE_BUTTON_CLASSES} onClick={onClose} disabled={busy} aria-label="Закрыть TEMP-форму"><X /></button>
        <p className="mb-2 text-xs font-extrabold tracking-[0.1em] text-[#f3bf45] uppercase">Разовое добавление</p>
        <h2 id="temp-product-title" className="mb-5 text-3xl font-black">Новая TEMP-позиция</h2>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-extrabold text-[#c7cfdb]">Название<input className="min-h-12 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-white" name="name" required autoFocus /></label>
          <label className="grid gap-2 text-sm font-extrabold text-[#c7cfdb]">Как указаны значения<select className="min-h-12 rounded-xl border border-white/12 bg-[#22334a] px-3.5 text-white" name="nutrition_basis" value={basis} onChange={(event) => setBasis(event.target.value)}><option value="serving">На всю порцию</option><option value="per_100g">На 100 г</option></select></label>
          {basis === "per_100g" && <label className="grid gap-2 text-sm font-extrabold text-[#c7cfdb]">Сколько граммов добавить<input className="min-h-12 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-white" name="quantity" type="number" min="1" step="1" defaultValue="100" required /></label>}
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-sm font-extrabold text-[#c7cfdb]">Калории<input className="min-h-12 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-white" name="kcal_basis" type="number" min="0" step="0.1" required /></label>
            <label className="grid gap-2 text-sm font-extrabold text-[#c7cfdb]">Белок, г<input className="min-h-12 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-white" name="protein_basis" type="number" min="0" step="0.1" required /></label>
          </div>
          <input type="hidden" name="meal_type" value={data.day.current_meal} />
        </div>
        {error && <p className={ERROR_MESSAGE_CLASSES}>{error}</p>}
        <button className={`${PRIMARY_ACTION_CLASSES} mt-5 w-full`} disabled={busy}>{busy ? "Добавляю…" : `Добавить в ${data.day.current_meal.toLowerCase()}`} <Zap size={18} /></button>
      </form>
    </div>
  );
}

export function ProductFinder({ data, onPick, onProductsChanged, notify }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState("active");
  const [archivedProducts, setArchivedProducts] = useState([]);
  const [tempProducts, setTempProducts] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [tempFormOpen, setTempFormOpen] = useState(false);
  const [promotingTemp, setPromotingTemp] = useState(null);
  const [productForm, setProductForm] = useState(null);
  const [categoryForm, setCategoryForm] = useState(false);
  const normalized = query.trim().toLowerCase();
  const benefitTags = [
    ...new Set(data.products.map((product) => product.benefit_tag).filter(Boolean)),
  ].sort();
  const recommendedIds = new Set(data.finisher_product_ids || []);
  const sourceProducts = scope === "archive" ? archivedProducts : data.products;
  const filteredProducts = sourceProducts
    .filter((product) => !category || product.category === category)
    .filter(
      (product) => !subcategory || String(product.subcategory_id) === String(subcategory),
    )
    .filter(
      (product) =>
        !normalized ||
        [product.name, product.brand, product.category, product.benefit_tag]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
    )
    .sort(
      (a, b) =>
        scope === "active"
          ? Number(recommendedIds.has(b.id)) - Number(recommendedIds.has(a.id))
          : a.name.localeCompare(b.name, "ru"),
    );
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const products = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [query, category, subcategory, scope]);
  useEffect(() => {
    if (scope === "archive") {
      api("/api/registry/archive")
        .then((result) => setArchivedProducts(result.products || []))
        .catch((reason) => notify(`Не удалось открыть архив: ${reason.message}`));
    }
    if (scope === "temp") {
      api("/api/temp-products")
        .then((result) => setTempProducts(result.products || []))
        .catch((reason) => notify(`Не удалось открыть TEMP: ${reason.message}`));
    }
  }, [scope, notify]);
  useEffect(() => {
    const selected = data.categories.find((item) => item.name === category);
    setSubcategory("");
    if (!selected) {
      setSubcategories([]);
      return;
    }
    api(`/api/categories/${selected.id}/subcategories`)
      .then((result) => setSubcategories(result.subcategories || []))
      .catch((reason) => notify(`Не удалось загрузить подкатегории: ${reason.message}`));
  }, [category, data.categories, notify]);
  async function createSubcategory() {
    const selected = data.categories.find((item) => item.name === category);
    if (!selected) return;
    const name = window.prompt(`Новая подкатегория для «${category}»`);
    if (!name?.trim()) return;
    try {
      const result = await api(`/api/categories/${selected.id}/subcategories`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setSubcategories(result.subcategories || []);
      await onProductsChanged();
      notify(`Подкатегория «${name.trim()}» создана`);
    } catch (reason) {
      notify(`Не удалось создать подкатегорию: ${reason.message}`);
    }
  }
  async function moveProduct(productId, subcategoryId) {
    try {
      await api(`/api/registry/${productId}/subcategory`, {
        method: "PATCH",
        body: JSON.stringify({ subcategory_id: subcategoryId }),
      });
      await onProductsChanged();
      const selected = data.categories.find((item) => item.name === category);
      const result = await api(`/api/categories/${selected.id}/subcategories`);
      setSubcategories(result.subcategories || []);
      notify("Позиция перемещена");
    } catch (reason) {
      notify(`Не удалось переместить позицию: ${reason.message}`);
    }
  }
  async function restoreArchived(product) {
    try {
      await api(`/api/registry/${product.id}/restore`, { method: "POST" });
      setArchivedProducts((items) => items.filter((item) => item.id !== product.id));
      await onProductsChanged();
      notify(`«${product.name}» восстановлен`);
    } catch (reason) {
      notify(`Не удалось восстановить: ${reason.message}`);
    }
  }
  function beginTempPromotion(tempProduct) {
    let servingGrams = 100;
    if (tempProduct.nutrition_basis === "serving") {
      servingGrams = Number(window.prompt("Вес одной порции в граммах", "100"));
      if (!Number.isFinite(servingGrams) || servingGrams <= 0) return;
    }
    const multiplier = tempProduct.nutrition_basis === "serving"
      ? 100 / servingGrams
      : 1;
    setPromotingTemp(tempProduct);
    setProductForm({
      name: tempProduct.name,
      serving_grams: servingGrams,
      serving_units: 1,
      unit_name: "порция",
      kcal_100: tempProduct.kcal_basis * multiplier,
      protein_100: tempProduct.protein_basis * multiplier,
      fat_100: 0,
      carbs_100: 0,
      benefit_tag: "обычный выбор",
      benefit_color: "#6d5dfc",
      __newFromTemp: true,
    });
  }
  return (
    <section className="finder-card min-h-[675px] min-w-0 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-[27px] text-[var(--ink)] shadow-[var(--shadow)]">
      <div className="mb-[17px] flex items-start justify-between gap-5">
        <div>
          <h2 className="m-0 text-[27px] tracking-[-0.04em]">
            {scope === "archive"
              ? "Архив продуктов"
              : scope === "temp"
                ? "Разовые позиции"
                : normalized || category
                  ? "Найдено в реестре"
                  : "Быстро добавить"}
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <InfoTip text="Поиск идёт по названию, бренду, типу продукта и цветной метке пользы." />
          <button type="button" className={MODE_BUTTON_BASE_CLASSES + " border-white/12 bg-[#22334a] text-[#c8d1de]"} onClick={() => setTempFormOpen(true)}>
            <Zap size={16} /> Быстро TEMP
          </button>
          <button type="button" className={MODE_BUTTON_BASE_CLASSES + (scope === "temp" ? " border-[#f3bf45] bg-[#f3bf45]/15 text-[#ffe098]" : " border-white/12 bg-[#22334a] text-[#c8d1de]")} onClick={() => setScope(scope === "temp" ? "active" : "temp")}>
            TEMP
          </button>
          <button type="button" className={MODE_BUTTON_BASE_CLASSES + (scope === "archive" ? " border-[#ff7699] bg-[#ff7699]/15 text-[#ffb5c8]" : " border-white/12 bg-[#22334a] text-[#c8d1de]")} onClick={() => setScope(scope === "archive" ? "active" : "archive")}>
            <Archive size={16} /> Архив
          </button>
          <button
            type="button"
            className={PRIMARY_ACTION_CLASSES}
            onClick={() => setProductForm("new")}
          >
            <Plus size={17} /> Новый продукт
          </button>
        </div>
      </div>
      {scope !== "temp" && <label className="flex h-[50px] items-center gap-2.5 rounded-[14px] border border-white/10 bg-[#22334a] px-3.5 text-[#aebbd0] transition duration-200 focus-within:border-[#71b9ff]/55 focus-within:bg-[#2c405c] focus-within:text-[#8dcdff] focus-within:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]">
        <Search size={20} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Суп, шницель, протеиновый…"
          className="w-full border-0 bg-transparent text-[15px] text-[var(--ink)] outline-0 placeholder:text-[#8c8798]"
          autoComplete="off"
        />
        {query && (
          <button
            className="grid cursor-pointer place-items-center border-0 bg-transparent p-[5px] text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={() => setQuery("")}
            aria-label="Очистить поиск"
          >
            <X size={17} />
          </button>
        )}
      </label>}
      {scope !== "temp" && <div className="flex gap-[5px] overflow-x-auto py-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-[7px] text-[13px] font-bold transition duration-200 ${
            !category
              ? "border-[var(--violet)] bg-[var(--violet)] text-white shadow-[0_7px_18px_rgba(109,93,252,0.2)]"
              : "border-white/10 bg-[#22334a] text-[#c8d1de] hover:border-[#71b9ff]/45 hover:bg-[#2c405c] hover:text-white"
          }`}
          onClick={() => setCategory("")}
        >
          Все
        </button>
        {data.categories.map((item) => {
          const Icon = ICONS[item.icon_key] || Utensils;
          return (
            <button
              key={item.id}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-[7px] text-[13px] font-bold transition duration-200 ${
                category === item.name
                  ? "border-[var(--violet)] bg-[var(--violet)] text-white shadow-[0_7px_18px_rgba(109,93,252,0.2)]"
                  : "border-white/10 bg-[#22334a] text-[#c8d1de] hover:border-[#71b9ff]/45 hover:bg-[#2c405c] hover:text-white"
              }`}
              onClick={() =>
                setCategory(category === item.name ? "" : item.name)
              }
            >
              <Icon size={15} /> {item.name}
            </button>
          );
        })}
      </div>}
      {scope === "active" && category && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-[#71b9ff]/55 px-3 text-xs font-extrabold text-[#8dcdff]" onClick={createSubcategory}>
            <FolderPlus size={15} /> Подкатегория
          </button>
          {subcategories.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`min-h-9 rounded-full border px-3 text-xs font-extrabold transition ${String(subcategory) === String(item.id) ? "border-[#71b9ff] bg-[#42a9ff]/20 text-white" : "border-white/12 bg-[#22334a] text-[#c8d1de]"}`}
              onClick={() => setSubcategory(String(subcategory) === String(item.id) ? "" : item.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => moveProduct(Number(event.dataTransfer.getData("text/product-id")), item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-[9px]">
        {scope === "temp" && tempProducts.map((product) => (
          <article key={product.id} className="flex min-h-[105px] items-center justify-between gap-4 rounded-2xl border border-[#f3bf45]/25 bg-[#2c405c] p-4">
            <span className="min-w-0"><b className="block truncate text-base">{product.name}</b><small className="text-[#aebbd0]">{product.kcal_basis} ккал · {product.protein_basis} г белка · {product.nutrition_basis === "serving" ? "порция" : "100 г"}</small></span>
            <button type="button" className="min-h-10 shrink-0 rounded-xl border border-[#f3bf45]/45 px-3 text-xs font-extrabold text-[#ffe098]" onClick={() => beginTempPromotion(product)}>В реестр</button>
          </article>
        ))}
        {scope !== "temp" && products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onPick={scope === "active" ? onPick : null}
            onEdit={scope === "active" ? setProductForm : restoreArchived}
            onDragStart={scope === "active" && category ? (event, selectedProduct) => event.dataTransfer.setData("text/product-id", String(selectedProduct.id)) : null}
            recommended={scope === "active" && recommendedIds.has(product.id)}
            ActionIcon={scope === "archive" ? RotateCcw : Pencil}
            actionLabel={scope === "archive" ? "Восстановить" : "Изменить"}
          />
        ))}
        {((scope === "temp" && !tempProducts.length) || (scope !== "temp" && !products.length)) && (
          <div className="col-span-full grid min-h-60 place-content-center justify-items-center gap-[7px] text-center text-[var(--muted)]">
            <Search size={28} />
            <b className="text-[var(--ink)]">
              {scope === "archive" ? "Архив пуст" : scope === "temp" ? "TEMP-позиций нет" : "Ничего не нашлось"}
            </b>
            <span className="text-xs">
              {scope === "active" ? "Проверь название или создай новую позицию." : "Здесь пока нечего показывать."}
            </span>
            {scope === "active" && <button
              type="button"
              className={PRIMARY_ACTION_CLASSES}
              onClick={() => setProductForm("new")}
            >
              <Plus size={17} /> Создать «{query.trim() || "новый продукт"}»
            </button>}
          </div>
        )}
      </div>
      {scope !== "temp" && <nav
        className="mt-4 flex min-h-12 items-center justify-between gap-4 border-t border-white/10 pt-4"
        aria-label="Страницы продуктов"
      >
        <span className="text-sm text-[var(--muted)]" role="status">
          {filteredProducts.length} позиций · страница {currentPage} из {pageCount}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-10 rounded-xl border border-white/12 bg-[#22334a] px-4 text-sm font-extrabold text-[#c8d1de] transition hover:border-[#71b9ff]/45 hover:bg-[#2c405c] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] disabled:cursor-default disabled:opacity-35"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Назад
            </button>
            <button
              type="button"
              className="min-h-10 rounded-xl border border-white/12 bg-[#22334a] px-4 text-sm font-extrabold text-[#c8d1de] transition hover:border-[#71b9ff]/45 hover:bg-[#2c405c] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] disabled:cursor-default disabled:opacity-35"
              disabled={currentPage === pageCount}
              onClick={() =>
                setPage((value) => Math.min(pageCount, value + 1))
              }
            >
              Далее
            </button>
          </div>
        )}
      </nav>}
      {productForm && (
        <ProductForm
          presentation="drawer"
          categories={data.categories}
          benefitTags={benefitTags}
          product={productForm === "new" || productForm?.__newFromTemp ? null : productForm}
          initialValues={productForm?.__newFromTemp ? productForm : null}
          initialName={productForm === "new" ? query.trim() : ""}
          onClose={() => setProductForm(null)}
          openCategory={() => setCategoryForm(true)}
          onCreated={async (product, historyUpdated) => {
            if (promotingTemp) {
              await api(`/api/temp-products/${promotingTemp.id}/promote`, {
                method: "POST",
                body: JSON.stringify({ product_id: product.id }),
              });
              setTempProducts((items) => items.filter((item) => item.id !== promotingTemp.id));
              setPromotingTemp(null);
            }
            await onProductsChanged();
            notify(
              historyUpdated
                ? `Позиция обновлена; пересчитано записей истории: ${historyUpdated}`
                : `«${product.name}» сохранён`,
            );
          }}
          onArchived={async (product) => {
            await onProductsChanged();
            notify(`«${product.name}» перемещён в архив`);
          }}
        />
      )}
      {categoryForm && (
        <CategoryDialog
          onClose={() => setCategoryForm(false)}
          onCreated={async () => {
            await onProductsChanged();
            notify("Категория создана");
          }}
        />
      )}
      {tempFormOpen && (
        <TempProductDialog
          data={data}
          onClose={() => setTempFormOpen(false)}
          onSaved={async () => {
            setTempFormOpen(false);
            await onProductsChanged();
            notify("TEMP-позиция добавлена в день");
          }}
        />
      )}
    </section>
  );
}
