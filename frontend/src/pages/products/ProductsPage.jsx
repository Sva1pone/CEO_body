import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  Camera,
  Check,
  FolderPlus,
  ImagePlus,
  Plus,
  Search,
  Star,
  Target,
  Timer,
  Upload,
  Utensils,
  X,
} from "lucide-react";

import { api } from "../../shared/api";
import { ICONS } from "../../shared/constants";
import { format } from "../../shared/format";
import { IMAGE_ACCEPT, imageFileError } from "../../shared/imageUpload";
import {
  CategoryIcon,
  CinematicHeroArt,
  ErrorState,
  Shell,
} from "../../shared/ui";

const MODAL_BACKDROP_CLASSES =
  "fixed inset-0 z-100 grid place-items-center overflow-y-auto bg-[#02060c]/80 p-6 backdrop-blur-xl animate-[fadeIn_180ms_ease_both] motion-reduce:animate-none";
const DIALOG_PANEL_CLASSES =
  "relative max-h-[calc(100vh-48px)] w-full overflow-y-auto rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)] animate-[modalIn_280ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none";
const CLOSE_BUTTON_CLASSES =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color,border-color] hover:border-[#71b9ff]/45 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] disabled:cursor-default disabled:opacity-45";
const FORM_LABEL_CLASSES =
  "grid min-w-0 gap-2 text-sm font-extrabold text-[#c7cfdb]";
const FORM_CONTROL_CLASSES =
  "min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#707b8c] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";
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
export function CategoryDialog({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6d5dfc");
  const [icon, setIcon] = useState("utensils");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEscapeToClose(onClose, busy);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name, color, icon_key: icon }),
      });
      onCreated(result.categories);
      onClose();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={MODAL_BACKDROP_CLASSES}
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && onClose()
      }
    >
      <form
        className={`${DIALOG_PANEL_CLASSES} grid max-w-[480px] gap-4 p-7`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-dialog-title"
        onSubmit={submit}
      >
        <button
          type="button"
          className={`${CLOSE_BUTTON_CLASSES} absolute top-5 right-5`}
          disabled={busy}
          onClick={onClose}
          aria-label="Закрыть создание категории"
        >
          <X />
        </button>
        <span className="grid size-14 place-items-center rounded-2xl border border-[#71b9ff]/25 bg-[#42a9ff]/12 text-[#8dcdff] shadow-[0_12px_30px_rgba(66,169,255,0.1)]">
          <FolderPlus />
        </span>
        <h2
          className="m-0 pr-14 text-3xl leading-tight font-black tracking-[-0.04em]"
          id="category-dialog-title"
        >
          Новая категория
        </h2>
        <p className="mt-[-6px] mb-1 text-sm leading-relaxed text-[#aeb7c6] text-pretty">
          Категория отвечает за тип продукта и его иконку, например «Супы» или
          «Напитки».
        </p>
        <label className={FORM_LABEL_CLASSES}>
          Название
          <input
            className={FORM_CONTROL_CLASSES}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
          />
        </label>
        <label className={FORM_LABEL_CLASSES}>
          Цвет
          <input
            className="h-12 w-full cursor-pointer rounded-xl border border-white/12 bg-white/[0.06] p-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>
        <label className={FORM_LABEL_CLASSES}>
          Иконка
          <select
            className={FORM_CONTROL_CLASSES}
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
          >
            {Object.keys(ICONS).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        {error && <p className={ERROR_MESSAGE_CLASSES}>{error}</p>}
        <button className={PRIMARY_ACTION_CLASSES} disabled={busy}>
          {busy ? "Создаю…" : "Создать категорию"}
        </button>
      </form>
    </div>
  );
}

export function ProductForm({
  categories,
  benefitTags,
  product,
  initialValues = null,
  initialName = "",
  onClose,
  onCreated,
  onArchived,
  openCategory,
  presentation = "dialog",
}) {
  const [preview, setPreview] = useState(product?.image_url || "");
  const [imagePositionX, setImagePositionX] = useState(
    Number(product?.image_position_x ?? 50),
  );
  const [imagePositionY, setImagePositionY] = useState(
    Number(product?.image_position_y ?? 50),
  );
  const [imageScale, setImageScale] = useState(
    Number(product?.image_scale ?? 1),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(product);
  const source = product || initialValues;
  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEscapeToClose(onClose, busy);
  const per100 = (field) =>
    source?.[`${field}_100`] ??
    (source?.serving_grams
      ? (source[field] * 100) / source.serving_grams
      : "");
  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const selectedImage = form.get("image");
      form.set("approximate", form.get("approximate") ? "true" : "false");
      if (editing) {
        const applyToHistory = Boolean(form.get("apply_to_history"));
        if (applyToHistory) {
          const impact = await api(
            `/api/registry/${product.id}/history-impact`,
          );
          const accepted = window.confirm(
            `Пересчитать ${impact.history_entries} исторических записей «${product.name}»? Это изменит отчёты за прошлые дни.`,
          );
          if (!accepted) return;
          form.set("history_confirmation", "confirmed");
        }

        setBusy(true);
        form.set(
          "apply_to_history",
          applyToHistory ? "true" : "false",
        );
        form.delete("image");
        const imagePlacement = {
          image_position_x: form.get("image_position_x"),
          image_position_y: form.get("image_position_y"),
          image_scale: form.get("image_scale"),
        };
        form.delete("image_position_x");
        form.delete("image_position_y");
        form.delete("image_scale");
        const result = await api(`/api/registry/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify(Object.fromEntries(form.entries())),
        });
        let savedProduct = result.product;
        if (selectedImage && typeof selectedImage === "object" && selectedImage.size) {
          const imageForm = new FormData();
          imageForm.set("image", selectedImage);
          const imageResult = await api(`/api/registry/${product.id}/image`, {
            method: "POST",
            body: imageForm,
          });
          savedProduct = imageResult.product;
        }
        await api(`/api/registry/${product.id}/image-placement`, {
          method: "PATCH",
          body: JSON.stringify(imagePlacement),
        });
        await onCreated(
          { ...savedProduct, ...imagePlacement },
          result.history_updated,
        );
        onClose();
      } else {
        setBusy(true);
        const result = await api("/api/registry", {
          method: "POST",
          body: form,
        });
        await onCreated(result.product, 0);
        onClose();
      }
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }
  function selectImage(file) {
    const validationError = imageFileError(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }
  async function archiveProduct() {
    if (!window.confirm(`Переместить «${product.name}» в архив? История питания сохранится.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/registry/${product.id}`, { method: "DELETE" });
      onArchived?.(product);
      onClose();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`${MODAL_BACKDROP_CLASSES} ${presentation === "drawer" ? "place-items-stretch justify-items-end p-0" : "place-items-start"}`}
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && onClose()
      }
    >
      <form
        className={`${DIALOG_PANEL_CLASSES} p-7 ${presentation === "drawer" ? "ml-auto h-screen max-h-screen max-w-[760px] rounded-none border-y-0 border-r-0" : "mx-auto my-5 max-w-[820px]"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        onSubmit={submit}
      >
        <div className="mb-6 flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-extrabold tracking-[0.1em] text-[#8dcdff] uppercase">
              Золотой реестр
            </p>
            <h2
              className="mt-0 mb-2 text-3xl leading-tight font-black tracking-[-0.04em]"
              id="product-form-title"
            >
              {editing ? "Изменить позицию" : "Новая позиция"}
            </h2>
            <p className="m-0 max-w-[65ch] text-sm leading-relaxed text-[#aeb7c6] text-pretty">
              КБЖУ всегда вводится на 100 г. Вес ниже — вес одной упаковки или
              стандартной порции.
            </p>
          </div>
          <button
            type="button"
            className={CLOSE_BUTTON_CLASSES}
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть форму продукта"
          >
            <X />
          </button>
        </div>
        <div className="mb-5 grid min-h-[160px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border-2 border-dashed border-[#51b2ff]/45 bg-[radial-gradient(circle_at_15%_10%,rgba(66,169,255,0.15),transparent_13rem),rgba(255,255,255,0.035)] p-4 shadow-[inset_0_0_30px_rgba(66,169,255,0.035)]">
            {preview ? (
              <img
                className="size-[118px] rounded-2xl border border-white/15 object-cover shadow-[0_12px_28px_rgba(0,0,0,0.3)]"
                src={preview}
                alt="Предпросмотр"
                style={{
                  objectPosition: `${imagePositionX}% ${imagePositionY}%`,
                  transform: `scale(${imageScale})`,
                }}
              />
            ) : (
              <span className="grid justify-items-center gap-1.5 text-center text-[#aeb8c8]">
                <Camera className="text-[#5eb8ff]" size={32} />
                <b>Фото необязательно</b>
                <small className="text-xs">PNG, JPG, WEBP или GIF</small>
              </span>
            )}
            <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#5bb2ff]/50 bg-[#3497ef]/20 px-4 text-sm font-extrabold text-[#d9efff] transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-[#79c1ff] hover:bg-[#389af1]/30 hover:text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#71b9ff]">
              <Upload size={17} /> Выбрать фото
              <input
                className="sr-only"
                type="file"
                name="image"
                accept={IMAGE_ACCEPT}
                onChange={(event) => selectImage(event.target.files?.[0])}
              />
            </label>
          </div>
        {editing && preview && (
          <div className="mb-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <label className={FORM_LABEL_CLASSES}>
              Кадр по горизонтали
              <input
                name="image_position_x"
                type="range"
                min="0"
                max="100"
                value={imagePositionX}
                onChange={(event) => setImagePositionX(Number(event.target.value))}
              />
            </label>
            <label className={FORM_LABEL_CLASSES}>
              Кадр по вертикали
              <input
                name="image_position_y"
                type="range"
                min="0"
                max="100"
                value={imagePositionY}
                onChange={(event) => setImagePositionY(Number(event.target.value))}
              />
            </label>
            <label className={FORM_LABEL_CLASSES}>
              Масштаб
              <input
                name="image_scale"
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={imageScale}
                onChange={(event) => setImageScale(Number(event.target.value))}
              />
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3.5">
          <label className={`${FORM_LABEL_CLASSES} col-span-2`}>
            Название
            <input
              className={FORM_CONTROL_CLASSES}
              name="name"
              defaultValue={source?.name || initialName}
              placeholder="Например: суп куриный"
              required
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Категория
            <span className="grid grid-cols-[minmax(0,1fr)_48px] gap-2">
              <select
                className={FORM_CONTROL_CLASSES}
                name="category"
                required
                defaultValue={source?.category || ""}
              >
                <option value="" disabled>
                  Выбрать
                </option>
                {categories.map((item) => (
                  <option key={item.id}>{item.name}</option>
                ))}
              </select>
              <button
                className="grid min-h-12 cursor-pointer place-items-center rounded-xl border border-[#5bb2ff]/30 bg-[#42a9ff]/12 text-[#8dcdff] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/55 hover:bg-[#42a9ff]/22 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
                type="button"
                onClick={openCategory}
                title="Создать категорию"
              >
                <Plus size={18} />
              </button>
            </span>
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Вес упаковки/порции, г
            <input
              className={FORM_CONTROL_CLASSES}
              name="serving_grams"
              type="number"
              min="1"
              step="1"
              defaultValue={source?.serving_grams}
              required
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Ккал на 100 г
            <input
              className={FORM_CONTROL_CLASSES}
              name="kcal_100"
              type="number"
              min="0"
              step="0.1"
              defaultValue={per100("kcal")}
              required
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Белок на 100 г
            <input
              className={FORM_CONTROL_CLASSES}
              name="protein_100"
              type="number"
              min="0"
              step="0.1"
              defaultValue={per100("protein")}
              required
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Жиры на 100 г
            <input
              className={FORM_CONTROL_CLASSES}
              name="fat_100"
              type="number"
              min="0"
              step="0.1"
              defaultValue={per100("fat")}
              required
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Углеводы на 100 г
            <input
              className={FORM_CONTROL_CLASSES}
              name="carbs_100"
              type="number"
              min="0"
              step="0.1"
              defaultValue={per100("carbs")}
              required
            />
          </label>
          <label className={`${FORM_LABEL_CLASSES} col-span-2`}>
            Метка пользы
            <input
              className={FORM_CONTROL_CLASSES}
              name="benefit_tag"
              list="benefit-tags"
              defaultValue={source?.benefit_tag}
              placeholder="Выбери из списка или введи новую"
            />
            <datalist id="benefit-tags">
              {benefitTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Цвет метки
            <input
              className="h-12 w-full cursor-pointer rounded-xl border border-white/12 bg-white/[0.06] p-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]"
              name="benefit_color"
              type="color"
              defaultValue={source?.benefit_color || "#6d5dfc"}
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            <span>
              Бренд <small className="font-medium text-[#8f99aa]">(необязательно)</small>
            </span>
            <input
              className={FORM_CONTROL_CLASSES}
              name="brand"
              defaultValue={source?.brand}
              placeholder="Производитель"
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Штук в порции
            <input
              className={FORM_CONTROL_CLASSES}
              name="serving_units"
              type="number"
              min="1"
              step="1"
              defaultValue={source?.serving_units || "1"}
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Штук в упаковке
            <input
              className={FORM_CONTROL_CLASSES}
              name="package_units"
              type="number"
              min="1"
              step="1"
              defaultValue={source?.package_units || ""}
            />
          </label>
          <label className={FORM_LABEL_CLASSES}>
            Единица
            <select
              className={FORM_CONTROL_CLASSES}
              name="unit_name"
              defaultValue={source?.unit_name || "порция"}
            >
              <option value="порция">порция</option>
              <option value="шт.">шт.</option>
              <option value="банка">банка</option>
            </select>
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm font-bold text-[#c7cfdb] hover:bg-white/[0.065]">
            <input
              className="size-5 shrink-0 accent-[#6d5dfc]"
              name="approximate"
              type="checkbox"
              defaultChecked={Boolean(source?.approximate)}
            />{" "}
            КБЖУ приблизительные
          </label>
          {editing && (
            <label className="col-span-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#f3bf45]/20 bg-[#f3bf45]/[0.07] px-3.5 text-sm font-bold text-[#e2d099] hover:bg-[#f3bf45]/10">
              <input
                className="size-5 shrink-0 accent-[#f3bf45]"
                name="apply_to_history"
                type="checkbox"
              /> Применить новое
              КБЖУ ко всем историческим записям этого товара
            </label>
          )}
          <label className={`${FORM_LABEL_CLASSES} col-span-2`}>
            Заметка
            <textarea
              className={`${FORM_CONTROL_CLASSES} min-h-[105px] resize-y py-3`}
              name="note"
              defaultValue={source?.note}
              placeholder="Когда лучше есть, особенности позиции…"
            />
          </label>
        </div>
        {error && <p className={ERROR_MESSAGE_CLASSES}>{error}</p>}
        <button
          className={`${PRIMARY_ACTION_CLASSES} mt-5 w-full`}
          disabled={busy}
        >
          {busy
            ? "Сохраняю…"
            : editing
              ? "Сохранить изменения"
              : "Добавить в реестр"}{" "}
          <Plus size={19} />
        </button>
        {editing && (
          <button
            type="button"
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-[#ff7699]/35 bg-[#ff7699]/10 px-5 text-sm font-extrabold text-[#ff9ab4] transition hover:border-[#ff7699]/60 hover:bg-[#ff7699]/18 hover:text-[#ffc0d0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7699]"
            disabled={busy}
            onClick={archiveProduct}
          >
            <Archive size={18} /> В архив
          </button>
        )}
      </form>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [benefitTags, setBenefitTags] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [productForm, setProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categoryForm, setCategoryForm] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    api("/api/registry")
      .then((result) => {
        setProducts(result.products);
        setCategories(result.categories);
        setBenefitTags(result.benefit_tags || []);
      })
      .catch((reason) => setError(reason.message));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timer);
  }, [toast]);
  async function uploadPhoto(product, file) {
    if (!file) return;
    const validationError = imageFileError(file);
    if (validationError) {
      setToast(validationError);
      return;
    }
    const form = new FormData();
    form.set("image", file);
    try {
      const result = await api(`/api/registry/${product.id}/image`, {
        method: "POST",
        body: form,
      });
      setProducts((items) =>
        items.map((item) => (item.id === product.id ? result.product : item)),
      );
      setToast(`Фото для «${product.name}» сохранено`);
    } catch (reason) {
      setToast(`Не удалось загрузить фото: ${reason.message}`);
    }
  }
  async function archiveProduct(product) {
    if (
      !window.confirm(
        `Убрать «${product.name}» из реестра? Он исчезнет из выбора, но останется в истории уже записанных дней.`,
      )
    )
      return;
    try {
      await api(`/api/registry/${product.id}`, { method: "DELETE" });
      setProducts((items) => items.filter((item) => item.id !== product.id));
      setToast(`«${product.name}» убран из реестра`);
    } catch (reason) {
      setToast(`Не удалось удалить: ${reason.message}`);
    }
  }
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = !category || product.category === category;
      const matchesQuery =
        !normalized ||
        [product.name, product.brand, product.category, product.benefit_tag]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [products, query, category]);
  if (error)
    return (
      <Shell active="registry" cinematic>
        <ErrorState error={error} retry={() => location.reload()} />
      </Shell>
    );
  return (
    <Shell active="registry" cinematic>
      {toast && (
        <div
          className="fixed top-6 right-6 z-150 flex animate-[toastIn_300ms_ease_both] items-center gap-2 rounded-[13px] bg-[#242033] px-4 py-3 text-xs font-bold text-white shadow-[0_15px_40px_rgba(28,22,49,0.3)] motion-reduce:animate-none [&_svg]:text-[#86e0c0]"
          data-testid="registry-toast"
        >
          <Check size={18} /> {toast}
        </div>
      )}
      <header
        className="cinematic-hero mb-6 flex min-h-[260px] items-end justify-between gap-10 px-8 py-8 text-white"
        style={{ "--hero-accent": "#42a9ff" }}
      >
        <CinematicHeroArt />
        <div className="relative z-[2] max-w-[800px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#71b9ff]/40 bg-[#42a9ff]/14 px-3 py-2 text-xs font-extrabold tracking-[0.06em] text-[#d9efff] uppercase">
            <BookOpen size={15} />
            Золотой реестр
          </span>
          <h1 className="my-4 text-[clamp(40px,4vw,62px)] leading-none font-black tracking-[-0.055em] text-balance">
            Все продукты — <span className="text-[#42a9ff]">в одном месте</span>
          </h1>
          <p className="m-0 max-w-[70ch] text-base leading-relaxed text-[#b8c0cf] text-pretty">
            Тип продукта отвечает за иконку. Цветная метка показывает, чем
            позиция полезна именно в твоей стратегии.
          </p>
        </div>
        <button
          className="relative z-[2] inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96]"
          onClick={() => setProductForm(true)}
        >
          <Camera size={19} /> Новая позиция + фото
        </button>
      </header>
      <section className="sticky top-3 z-20 mt-[18px] flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#0a0f19]/85 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <label className="flex min-h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-[13px] border border-white/10 bg-white/[0.06] px-3.5 text-[#8f99aa] transition-[border-color,background-color,box-shadow] focus-within:border-[#71b9ff]/55 focus-within:bg-white/[0.09] focus-within:text-[#8dcdff] focus-within:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]">
          <Search size={20} />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-base text-white outline-none placeholder:text-[#7f899b]"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, бренд или метка пользы"
          />
          {query && (
            <button
              className="grid size-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#8f99aa] transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]"
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
            >
              <X size={17} />
            </button>
          )}
        </label>
        <button
          className="inline-flex min-h-[50px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.065] px-4 text-sm font-extrabold text-[#d4d9e3] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/50 hover:bg-[#42a9ff]/12 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
          onClick={() => setCategoryForm(true)}
        >
          <FolderPlus size={18} /> Добавить категорию
        </button>
      </section>
      <div className="flex gap-2 overflow-x-auto px-0.5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold transition-[transform,background-color,border-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${
            !category
              ? "border-[#71b9ff]/70 bg-[linear-gradient(135deg,#367fe7,#275cb6)] text-white shadow-[0_8px_25px_rgba(36,107,210,0.28)]"
              : "border-white/10 bg-white/[0.055] text-[#aeb7c6] hover:border-[#71b9ff]/45 hover:bg-[#42a9ff]/10 hover:text-white"
          }`}
          onClick={() => setCategory("")}
        >
          Все
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">
            {products.length}
          </span>
        </button>
        {categories.map((item) => {
          const Icon = ICONS[item.icon_key] || Utensils;
          const count = products.filter(
            (product) => product.category === item.name,
          ).length;
          return (
            <button
              key={item.id}
              className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold transition-[transform,background-color,border-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96] ${
                category === item.name
                  ? "border-[#71b9ff]/70 bg-[linear-gradient(135deg,#367fe7,#275cb6)] text-white shadow-[0_8px_25px_rgba(36,107,210,0.28)]"
                  : "border-white/10 bg-white/[0.055] text-[#aeb7c6] hover:text-white"
              }`}
              onClick={() =>
                setCategory(category === item.name ? "" : item.name)
              }
            >
              <Icon size={16} />
              {item.name}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex items-center justify-between px-0.5 text-sm text-[#aeb7c6]">
        <span>
          Показано <b>{visible.length}</b> из {products.length}
        </span>
        <span className="flex items-center gap-2">
          <Star className="text-[#f3bf45]" size={16} /> Метки не меняют расчёты КБЖУ
        </span>
      </div>
      <section className="grid grid-cols-3 gap-4">
        {visible.map((product) => (
          <article
            className="group relative isolate flex min-h-[310px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(25,31,48,0.97),rgba(11,16,27,0.97))] p-5 pb-[72px] text-white shadow-[0_15px_36px_rgba(0,0,0,0.22)] transition-[transform,border-color,box-shadow] before:pointer-events-none before:absolute before:inset-y-5 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--tag,#42a9ff)] before:shadow-[0_0_17px_var(--tag,#42a9ff)] before:content-[''] hover:-translate-y-1 hover:border-[#5badff]/40 hover:shadow-[0_22px_48px_rgba(0,0,0,0.32)]"
            key={product.id}
            style={{ "--tag": product.benefit_color }}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <CategoryIcon
                product={product}
                size={27}
                className="size-[62px] rounded-[18px]"
              />
              <span
                className="inline-flex max-w-[68%] rounded-full border px-2.5 py-1.5 text-[11px] font-extrabold tracking-[0.04em] uppercase"
                style={{
                  borderColor: `color-mix(in srgb, ${product.benefit_color} 38%, transparent)`,
                  background: `color-mix(in srgb, ${product.benefit_color} 15%, #111827)`,
                  color: `color-mix(in srgb, ${product.benefit_color} 74%, white)`,
                }}
              >
                {product.benefit_tag}
              </span>
            </div>
            <div>
              <small className="text-xs font-extrabold tracking-[0.08em] text-[#69bcff] uppercase">
                {product.category}
              </small>
              <h2 className="my-2 text-xl leading-snug font-black tracking-[-0.025em] text-balance">
                {product.name}
              </h2>
              <p className="m-0 text-sm leading-relaxed text-[#aeb7c6]">
                {product.brand || "Без бренда"} · {product.serving_label}
              </p>
            </div>
            <div className="mt-auto grid grid-cols-4 gap-2 pt-5">
              <span className="min-w-0 rounded-[10px] border border-white/[0.06] bg-white/[0.045] px-1.5 py-2.5 text-center text-[10px] text-[#8f99aa] uppercase">
                <b className="mb-0.5 block overflow-hidden text-sm font-black tabular-nums text-white">{format(product.kcal, 1)}</b>ккал
              </span>
              <span className="min-w-0 rounded-[10px] border border-white/[0.06] bg-white/[0.045] px-1.5 py-2.5 text-center text-[10px] text-[#8f99aa] uppercase">
                <b className="mb-0.5 block overflow-hidden text-sm font-black tabular-nums text-white">{format(product.protein, 1)}</b>белок
              </span>
              <span className="min-w-0 rounded-[10px] border border-white/[0.06] bg-white/[0.045] px-1.5 py-2.5 text-center text-[10px] text-[#8f99aa] uppercase">
                <b className="mb-0.5 block overflow-hidden text-sm font-black tabular-nums text-white">{format(product.fat, 1)}</b>жиры
              </span>
              <span className="min-w-0 rounded-[10px] border border-white/[0.06] bg-white/[0.045] px-1.5 py-2.5 text-center text-[10px] text-[#8f99aa] uppercase">
                <b className="mb-0.5 block overflow-hidden text-sm font-black tabular-nums text-white">{format(product.carbs, 1)}</b>угли
              </span>
            </div>
            {product.note && (
              <p className="mt-3 mb-0 rounded-[10px] border border-[#f3bf45]/15 bg-[#f3bf45]/[0.07] px-3 py-2 text-xs leading-relaxed text-[#d8c27e]">
                {product.note}
              </p>
            )}
            <label className="absolute right-4 bottom-4 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#5bb2ff]/45 bg-[#2a89e2]/15 px-3 text-xs font-extrabold text-[#bfe4ff] transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-[#79c1ff] hover:bg-[#2a89e2]/25 hover:text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#71b9ff]">
              <ImagePlus size={16} />
              {product.image_url ? "Заменить фото" : "Добавить фото"}
              <input
                className="sr-only"
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={(event) => {
                  uploadPhoto(product, event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <button
              className="absolute bottom-4 left-4 min-h-10 cursor-pointer rounded-xl border border-[#f3bf45]/45 bg-[#f3bf45]/12 px-3 text-xs font-extrabold text-[#ffe39a] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#f3bf45]/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3bf45] active:scale-[0.96]"
              onClick={() => setEditingProduct(product)}
            >
              Изменить
            </button>
            <button
              className="absolute bottom-4 left-[108px] min-h-10 cursor-pointer rounded-xl border border-[#ff5e78]/35 bg-[#ff405f]/10 px-3 text-xs font-extrabold text-[#ffacb8] transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-[#ff7699]/55 hover:bg-[#ff405f]/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7699] active:scale-[0.96]"
              onClick={() => archiveProduct(product)}
            >
              Удалить
            </button>
          </article>
        ))}
        {!visible.length && (
          <div className="col-span-full grid min-h-[340px] place-content-center justify-items-center gap-2 rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] text-center text-sm text-[#aeb7c6]">
            <Search size={30} />
            <b className="text-lg text-white">Ничего не найдено</b>
            <span>Сними фильтр или добавь новую позицию.</span>
          </div>
        )}
      </section>
      {productForm && (
        <ProductForm
          categories={categories}
          benefitTags={benefitTags}
          onClose={() => setProductForm(false)}
          openCategory={() => setCategoryForm(true)}
          onCreated={(product) => {
            setProducts((items) => [...items, product]);
            setBenefitTags((tags) =>
              [...new Set([...tags, product.benefit_tag])].sort(),
            );
          }}
        />
      )}
      {editingProduct && (
        <ProductForm
          categories={categories}
          benefitTags={benefitTags}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          openCategory={() => setCategoryForm(true)}
          onCreated={(product, historyUpdated) => {
            setProducts((items) =>
              items.map((item) => (item.id === product.id ? product : item)),
            );
            setBenefitTags((tags) =>
              [...new Set([...tags, product.benefit_tag])].sort(),
            );
            setToast(
              historyUpdated
                ? `Позиция обновлена; пересчитано записей истории: ${historyUpdated}`
                : "Позиция обновлена; история не изменялась",
            );
          }}
        />
      )}
      {categoryForm && (
        <CategoryDialog
          onClose={() => setCategoryForm(false)}
          onCreated={setCategories}
        />
      )}
    </Shell>
  );
}
