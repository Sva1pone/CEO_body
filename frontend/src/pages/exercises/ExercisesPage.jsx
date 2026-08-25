import React from "react";
import { Camera, Dumbbell, Plus, X } from "lucide-react";

import MuscleMap from "../../shared/MuscleMap";
import { IMAGE_ACCEPT } from "../../shared/imageUpload";
import {
  CinematicHeroArt,
  ErrorState,
  Loading,
  Shell,
} from "../../shared/ui";
import { useExerciseCatalog } from "./useExerciseCatalog";

const FORM_LABEL_CLASSES =
  "grid min-w-0 gap-2 text-sm font-extrabold text-[#c7cfdb]";
const FORM_CONTROL_CLASSES =
  "min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#707b8c] focus:border-[#71b9ff]/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(66,169,255,0.1)]";

export default function ExercisesPage() {
  const {
    data,
    error,
    editor,
    activeTemplateId,
    activeSubgroupId,
    collapsed,
    subgroupMenuId,
    dragUi,
    armingId,
    isSaving,
    form,
    currentTemplate,
    subgroups,
    currentSubgroup,
    items,
    displayedItems,
    load,
    selectTemplate,
    openEditor,
    save,
    upload,
    archive,
    createSubgroup,
    toggleSubgroup,
    renameSubgroup,
    deleteSubgroup,
    beginCardHold,
    applyLlmBlock,
    setActiveSubgroupId,
    setCollapsed,
    setSubgroupMenuId,
    setEditor,
    setForm,
  } = useExerciseCatalog();
  React.useEffect(() => {
    if (!editor) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setEditor(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, setEditor]);
  if (error && !data)
    return (
      <Shell active="exercises" cinematic>
        <ErrorState error={error} retry={load} />
      </Shell>
    );
  if (!data)
    return (
      <Shell active="exercises" cinematic>
        <Loading />
      </Shell>
    );
  return (
    <Shell active="exercises" cinematic>
      <div className="min-w-0">
        <header
          className="cinematic-hero mb-6 flex min-h-[270px] items-end justify-between gap-10 px-8 py-8 text-white"
          style={{ "--hero-accent": "#f81633" }}
        >
          <CinematicHeroArt />
          <div className="relative z-[2] max-w-[800px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ff79a9]/40 bg-[#f05f97]/14 px-3 py-2 text-xs font-extrabold tracking-[0.06em] text-[#ffd4e4] uppercase">
              <Dumbbell size={15} />
              Каталог упражнений
            </span>
            <h1 className="my-4 text-[clamp(40px,4vw,62px)] leading-none font-black tracking-[-0.055em] text-balance">
              Твоя карта <span className="text-[#ff79a9]">движений</span>
            </h1>
            <p className="m-0 max-w-[65ch] text-base leading-relaxed text-[#b8c0cf] text-pretty">
              Сначала выбери тренировочный день, затем мышечную подгруппу.
            </p>
          </div>
          <button
            className="relative z-[2] inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96]"
            onClick={() => openEditor()}
          >
            <Plus size={18} /> Новое упражнение
          </button>
        </header>
        {error && (
          <p className="my-3 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-3 py-2.5 text-sm leading-relaxed text-[#ffb5c8]">
            {error}
          </p>
        )}
        <nav className="my-5 grid grid-cols-3 gap-3" aria-label="Тренировочный день">
          {data.templates.map((template) => (
            <button
              type="button"
              key={template.id}
              className={`min-h-[58px] cursor-pointer rounded-[15px] border px-5 text-base font-extrabold transition-[transform,background-color,border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a8fff] active:scale-[0.96] ${
                template.id === activeTemplateId
                  ? "border-[#6c75ff] bg-[linear-gradient(135deg,rgba(92,80,255,0.25),rgba(55,119,210,0.14))] text-white shadow-[0_0_24px_rgba(80,92,255,0.15)]"
                  : "border-[#859dc2]/25 bg-[#111929] text-[#c8d3e2] hover:border-[#6c75ff]/60 hover:bg-[#172137] hover:text-white"
              }`}
              onClick={() => selectTemplate(template.id)}
            >
              {template.name}
            </button>
          ))}
        </nav>
        <nav
          className="exercise-subgroup-tabs mb-5 flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"
          aria-label="Подгруппа упражнений"
        >
          {subgroups.map((group) => (
            <div
              key={group.id}
              data-subgroup-id={group.id}
              className={`relative flex overflow-visible rounded-[14px] border transition-[transform,border-color,box-shadow] ${
                group.id === activeSubgroupId
                  ? "border-[#4ba6ec] bg-[#19314d] shadow-[0_0_20px_rgba(75,166,236,0.12)]"
                  : "border-[#859dc2]/25 bg-[#111929]"
              } ${
                dragUi?.targetSubgroupId === group.id
                  ? "z-[4] -translate-y-0.5 border-[#7bd0ff] shadow-[0_0_0_3px_rgba(75,166,236,0.2),0_0_28px_rgba(75,166,236,0.38)]"
                  : ""
              }`}
            >
              <button
                type="button"
                className={`min-h-11 cursor-pointer rounded-l-[13px] border-0 bg-transparent px-4 text-sm font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] ${
                  group.id === activeSubgroupId
                    ? "text-white"
                    : "text-[#c8d3e2] hover:text-white"
                }`}
                onClick={() => {
                  setActiveSubgroupId(group.id);
                  setCollapsed(Boolean(group.collapsed));
                  setSubgroupMenuId(null);
                }}
              >
                {group.name}
              </button>
              <button
                type="button"
                className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-r-[13px] border-0 bg-transparent px-2 text-lg text-[#8ea6c5] transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff]"
                aria-label={`Действия с подгруппой ${group.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSubgroupMenuId(
                    subgroupMenuId === group.id ? null : group.id,
                  );
                }}
              >
                •••
              </button>
              {subgroupMenuId === group.id && (
                <div className="absolute top-[calc(100%+7px)] right-0 z-30 grid min-w-[210px] overflow-hidden rounded-xl border border-[#35455f] bg-[#111a2a] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.48)]">
                  <button
                    className="min-h-10 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-left text-sm font-bold text-[#c8d3e2] hover:bg-[#21314a] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#71b9ff]"
                    type="button"
                    onClick={() => renameSubgroup(group)}
                  >
                    Переименовать
                  </button>
                  <button
                    type="button"
                    className="min-h-10 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-left text-sm font-bold text-[#ff91a1] hover:bg-[#ff405f]/12 hover:text-[#ffc0ca] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ff7699]"
                    onClick={() => deleteSubgroup(group)}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[14px] border border-dashed border-[#5bb2ff]/45 bg-[#42a9ff]/[0.07] px-4 text-sm font-extrabold text-[#87c9ff] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/70 hover:bg-[#42a9ff]/14 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
            onClick={createSubgroup}
          >
            <Plus size={16} /> Новая подгруппа
          </button>
        </nav>
        {currentSubgroup ? (
          <section className="overflow-hidden rounded-[22px] border border-[#89a6ce]/20 bg-[#090f19]/50">
            <header className="flex items-end justify-between gap-5 border-b border-white/[0.07] px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-extrabold tracking-[0.1em] text-[#8dcdff] uppercase">
                  {currentTemplate?.name}
                </p>
                <h2 className="my-1 text-3xl leading-tight font-black tracking-[-0.04em] text-white text-balance">
                  {currentSubgroup.name}
                </h2>
                <small className="text-sm leading-relaxed text-[#9cacc2]">
                  {items.length} упражнений · коротко зажми пустую область и
                  тащи
                </small>
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[13px] border border-white/15 bg-white/[0.07] px-4 text-sm font-extrabold text-[#e7ebf2] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/50 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
                onClick={toggleSubgroup}
              >
                {collapsed ? "Развернуть" : "Свернуть"}
              </button>
            </header>
            {!collapsed && (
              <div className="grid gap-4 p-4">
                {displayedItems.map((item, index) => (
                  <div className="contents" key={item.id}>
                    {dragUi?.targetSubgroupId === activeSubgroupId &&
                      dragUi.targetIndex === index && (
                        <div
                          className="grid place-items-center overflow-hidden rounded-[18px] border-2 border-dashed border-[#55b9ff] bg-[#399be2]/12 text-base font-black text-[#9ed9ff] shadow-[inset_0_0_30px_rgba(45,142,216,0.08)] animate-[exerciseGapOpen_180ms_cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none"
                          style={{ height: dragUi.height, minHeight: dragUi.height }}
                        >
                          Отпусти здесь
                        </div>
                      )}
                    <article
                      data-exercise-id={item.id}
                      style={{ viewTransitionName: `exercise-card-${item.id}` }}
                      className={`exercise-catalog-row relative grid min-h-[300px] cursor-grab touch-none grid-cols-[260px_minmax(430px,1.15fr)_minmax(300px,0.78fr)_390px] overflow-hidden rounded-[20px] border bg-[linear-gradient(115deg,rgba(31,42,61,0.98),rgba(17,25,39,0.98))] shadow-[0_18px_46px_rgba(0,0,0,0.2)] transition-[transform,border-color,box-shadow] active:cursor-grabbing ${armingId === item.id ? "scale-[0.997] border-[#64c4ff]/75 shadow-[0_18px_46px_rgba(0,0,0,0.25),0_0_0_3px_rgba(78,177,239,0.12)] after:pointer-events-none after:absolute after:top-0 after:left-0 after:z-20 after:h-1 after:w-full after:rounded-r after:bg-[linear-gradient(90deg,#6dc8ff,#8a70ff)] after:shadow-[0_0_16px_#6dc8ff] after:content-['']" : "border-[#88a2ca]/20"}`}
                      onPointerDown={(event) =>
                        beginCardHold(event, item, index)
                      }
                    >
                      <div className="exercise-photo-column grid cursor-auto grid-rows-[minmax(0,1fr)_44px] gap-3 border-r border-white/[0.07] p-4 select-auto">
                        {item.image_url ? (
                          <img
                            className="h-[220px] w-full rounded-[14px] border border-white/10 bg-[#f7f7f7] object-contain shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                            src={item.image_url}
                            alt={`Фото: ${item.name}`}
                          />
                        ) : (
                          <span className="catalog-exercise-placeholder grid h-[220px] w-full place-items-center rounded-[14px] border border-white/10 bg-[#f7f7f7] text-[#53708d]">
                            <Dumbbell size={42} />
                          </span>
                        )}
                        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#3d5878] bg-[#15263a] px-3 text-sm font-extrabold text-[#9fd5ff] transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-[#71b9ff]/70 hover:bg-[#1b324c] hover:text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#71b9ff]">
                          <Camera size={16} />
                          {item.image_url ? "Заменить фото" : "Добавить фото"}
                          <input
                            className="sr-only"
                            type="file"
                            accept={IMAGE_ACCEPT}
                            onChange={(event) => {
                              upload(item, event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      <div className="exercise-row-info flex min-w-0 cursor-auto flex-col p-6 select-auto">
                        <h3 className="m-0 text-2xl leading-tight font-black tracking-[-0.03em] text-white text-balance">
                          {item.name}
                        </h3>
                        <p className="mt-2 mb-0 text-sm font-bold text-[#bdc9d9]">
                          {currentTemplate?.name} · {currentSubgroup.name}
                        </p>
                        <div className="my-4 grid gap-2 text-sm font-extrabold">
                          <span className="text-[#ff6471]">
                            Эффективность{" "}
                            {"●".repeat(item.effectiveness_rating || 3)}
                            <i className="font-normal text-[#59667a] not-italic">
                              {"●".repeat(5 - (item.effectiveness_rating || 3))}
                            </i>
                          </span>
                          <span className="text-[#ffc851]">
                            Сложность {"◆".repeat(item.difficulty_rating || 3)}
                            <i className="font-normal text-[#59667a] not-italic">
                              {"◆".repeat(5 - (item.difficulty_rating || 3))}
                            </i>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="min-w-0 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3">
                            <b className="mb-2 block text-[13px] text-[#cbd6e5]">Основные мышцы</b>
                            {(item.muscle_profile?.primary || []).map(
                              (name) => (
                                <span className="mr-1.5 mb-1 inline-block rounded-full border border-[#ff4e5e]/45 bg-[#ff4053]/10 px-2 py-1 text-xs text-[#ff9da6]" key={name}>
                                  {name}
                                </span>
                              ),
                            )}
                          </div>
                          <div className="min-w-0 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3">
                            <b className="mb-2 block text-[13px] text-[#cbd6e5]">Вторичные мышцы</b>
                            {(item.muscle_profile?.secondary || []).map(
                              (name) => (
                                <span className="mr-1.5 mb-1 inline-block rounded-full border border-[#f5bd48]/40 px-2 py-1 text-xs text-[#f8d47f]" key={name}>{name}</span>
                              ),
                            )}
                          </div>
                        </div>
                        <div className="mt-auto flex items-center gap-2 pt-4">
                          <button
                            className="min-h-10 cursor-pointer rounded-[10px] border border-[#3b4d67] bg-[#25334a] px-3 text-sm font-black text-[#f4d17d] transition-[transform,background-color,border-color] hover:border-[#f3bf45]/55 hover:bg-[#2f405b] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3bf45] active:scale-[0.96]"
                            type="button"
                            onClick={() => openEditor(item)}
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="min-h-10 cursor-pointer rounded-[10px] border border-[#ff7699]/25 bg-[#ff405f]/[0.08] px-3 text-sm font-black text-[#ff9aaa] transition-[transform,background-color,border-color] hover:border-[#ff7699]/55 hover:bg-[#ff405f]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7699] active:scale-[0.96]"
                            onClick={() => archive(item)}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                      <div className="exercise-row-note my-5 flex min-w-0 cursor-auto flex-col border-x border-white/[0.07] px-5 py-4 select-auto">
                        <b className="text-base text-white">Техника / заметка</b>
                        <p className="mt-2 mb-0 text-sm leading-relaxed text-[#becadc] text-pretty [overflow-wrap:anywhere]">
                          {item.note || "Заметка пока не заполнена."}
                        </p>
                      </div>
                      <div className="exercise-row-map min-w-0 cursor-auto p-3 select-auto [&>.muscle-map]:h-full [&>.muscle-map]:min-h-[274px] [&>.muscle-map]:w-full [&>.muscle-map]:min-w-0 [&>.muscle-map]:[aspect-ratio:auto] [&>.muscle-map_svg]:h-full [&>.muscle-map_svg]:w-full">
                        <MuscleMap profile={item.muscle_profile} compact />
                      </div>
                    </article>
                  </div>
                ))}
                {dragUi?.targetSubgroupId === activeSubgroupId &&
                  dragUi.targetIndex >= displayedItems.length && (
                    <div
                      className="grid place-items-center overflow-hidden rounded-[18px] border-2 border-dashed border-[#55b9ff] bg-[#399be2]/12 text-base font-black text-[#9ed9ff] shadow-[inset_0_0_30px_rgba(45,142,216,0.08)] animate-[exerciseGapOpen_180ms_cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none"
                      style={{ height: dragUi.height, minHeight: dragUi.height }}
                    >
                      Отпусти здесь
                    </div>
                  )}
                {!items.length && (
                  <div className="grid min-h-40 place-items-center rounded-[18px] border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm text-[#9cacc2]">
                    В этой подгруппе пока нет упражнений. Перетащи сюда карточку
                    через кнопку подгруппы или добавь новое упражнение.
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <div className="grid min-h-40 place-items-center rounded-[18px] border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm text-[#9cacc2]">
            Создай или выбери подгруппу.
          </div>
        )}
        {dragUi && (
          <div
            className={`pointer-events-none fixed z-[4000] grid rotate-[0.5deg] border border-[#6dc8ff] bg-[linear-gradient(120deg,rgba(31,44,67,0.98),rgba(13,22,37,0.98))] shadow-[0_28px_75px_rgba(0,0,0,0.58),0_0_32px_rgba(72,172,238,0.28)] ${dragUi.compact ? "min-h-[82px] w-[430px] scale-[0.94] grid-cols-[62px_minmax(0,1fr)] gap-3 rounded-[14px] p-[9px] [&>em]:hidden [&>img]:size-[62px] [&>span]:size-[62px] [&_b]:text-base" : "min-h-[145px] w-[560px] grid-cols-[112px_minmax(0,1fr)] gap-[15px] rounded-2xl p-[13px] [&>img]:size-28 [&>span]:size-28 [&_b]:text-[19px]"}`}
            style={{
              left: Math.max(
                8,
                Math.min(
                  window.innerWidth - (dragUi.compact ? 430 : 560),
                  dragUi.x - Math.min(dragUi.offsetX, 180),
                ),
              ),
              top: Math.max(
                8,
                Math.min(
                  window.innerHeight - (dragUi.compact ? 86 : 150),
                  dragUi.y - Math.min(dragUi.offsetY, 70),
                ),
              ),
            }}
          >
            {dragUi.item.image_url ? (
              <img className="row-span-2 grid place-items-center rounded-[11px] bg-[#f5f6f7] object-contain" src={dragUi.item.image_url} alt="" />
            ) : (
              <span className="row-span-2 grid place-items-center rounded-[11px] bg-[#f5f6f7] text-[#53708d]">
                <Dumbbell size={30} />
              </span>
            )}
            <div className="grid min-w-0 content-center gap-2">
              <b className="overflow-hidden font-black text-ellipsis whitespace-nowrap text-white">{dragUi.item.name}</b>
              <small className="text-[13px] text-[#8fcfff]">
                {dragUi.targetSubgroupId === activeSubgroupId
                  ? "Новый порядок в списке"
                  : `Перенос в «${subgroups.find((group) => group.id === dragUi.targetSubgroupId)?.name || "подгруппу"}»`}
              </small>
            </div>
            <em className="self-end overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[#f2cb78] not-italic">
              {(dragUi.item.muscle_profile?.primary || []).join(" · ") ||
                "мышцы не указаны"}
            </em>
          </div>
        )}
        {editor && (
          <div
            className="fixed inset-0 z-100 grid place-items-start overflow-y-auto bg-[#02060c]/80 p-6 backdrop-blur-xl animate-[fadeIn_180ms_ease_both] motion-reduce:animate-none"
            onMouseDown={(event) =>
              event.target === event.currentTarget && setEditor(null)
            }
          >
            <form
              className="relative mx-auto my-5 grid max-h-[calc(100vh-48px)] w-full max-w-[980px] gap-4 overflow-y-auto rounded-3xl border border-white/12 bg-[linear-gradient(145deg,rgba(23,29,45,0.99),rgba(9,14,24,0.99))] p-7 text-white shadow-[0_38px_100px_rgba(0,0,0,0.58)] animate-[modalIn_280ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exercise-editor-title"
              onSubmit={save}
            >
              <button
                type="button"
                className="absolute top-5 right-5 z-10 grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-[#b8c0cf] transition-[transform,background-color,color,border-color] hover:border-[#71b9ff]/45 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
                onClick={() => setEditor(null)}
                aria-label="Закрыть форму упражнения"
              >
                <X />
              </button>
              <div className="pr-14">
                <p className="mb-2 text-xs font-extrabold tracking-[0.1em] text-[#ff79a9] uppercase">
                  Каталог упражнений
                </p>
                <h2
                  className="m-0 text-3xl leading-tight font-black tracking-[-0.04em] text-balance"
                  id="exercise-editor-title"
                >
                  {editor.id ? "Изменить упражнение" : "Новое упражнение"}
                </h2>
              </div>
              <label className={FORM_LABEL_CLASSES}>
                Название
                <input
                  className={FORM_CONTROL_CLASSES}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </label>
              <label className={FORM_LABEL_CLASSES}>
                Группа мышц / роль
                <input
                  className={FORM_CONTROL_CLASSES}
                  value={form.muscle_group}
                  onChange={(e) =>
                    setForm({ ...form, muscle_group: e.target.value })
                  }
                  placeholder="Например: верх груди"
                />
              </label>
              <fieldset className="grid gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4">
                <legend className="px-2 text-sm font-black text-[#dbe7f5]">
                  Тренировочные дни и подгруппы
                </legend>
                {data.templates.map((template) => {
                  const checked = form.template_ids.includes(template.id);
                  const groups = data.subgroups.filter(
                    (group) => group.template_id === template.id,
                  );
                  return (
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] items-center gap-3" key={template.id}>
                      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-sm font-bold text-[#c7cfdb] hover:bg-white/[0.06]">
                        <input
                          className="size-5 shrink-0 accent-[#6d5dfc]"
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              template_ids: e.target.checked
                                ? [...form.template_ids, template.id]
                                : form.template_ids.filter(
                                    (id) => id !== template.id,
                                  ),
                            })
                          }
                        />{" "}
                        {template.name}
                      </label>
                      {checked && (
                        <select
                          className={FORM_CONTROL_CLASSES}
                          value={
                            form.subgroup_ids[template.id] ||
                            groups[0]?.id ||
                            ""
                          }
                          onChange={(e) =>
                            setForm({
                              ...form,
                              subgroup_ids: {
                                ...form.subgroup_ids,
                                [template.id]: Number(e.target.value),
                              },
                            })
                          }
                        >
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <label className={FORM_LABEL_CLASSES}>
                Вставить параметры из LLM
                <textarea
                  className={`${FORM_CONTROL_CLASSES} min-h-[120px] resize-y py-3 font-mono leading-relaxed`}
                  value={form.llm_block}
                  onChange={(e) =>
                    setForm({ ...form, llm_block: e.target.value })
                  }
                  placeholder={
                    "эффективность: 3\nсложность: 3\nосновные мышцы: грудь\nвторичные мышцы: трицепс"
                  }
                />
              </label>
              <button
                type="button"
                className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center rounded-[13px] border border-white/15 bg-white/[0.07] px-4 text-sm font-extrabold text-[#e7ebf2] transition-[transform,background-color,border-color] hover:border-[#71b9ff]/50 hover:bg-[#42a9ff]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71b9ff] active:scale-[0.96]"
                onClick={applyLlmBlock}
              >
                Распознать и заполнить поля
              </button>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 text-sm font-extrabold text-[#ff8b94]">
                  Эффективность: <b>{form.effectiveness_rating}/5</b>
                  <input
                    className="w-full accent-[#f16464]"
                    type="range"
                    min="1"
                    max="5"
                    value={form.effectiveness_rating}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        effectiveness_rating: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4 text-sm font-extrabold text-[#ffd16c]">
                  Сложность: <b>{form.difficulty_rating}/5</b>
                  <input
                    className="w-full accent-[#f3b947]"
                    type="range"
                    min="1"
                    max="5"
                    value={form.difficulty_rating}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        difficulty_rating: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-[minmax(220px,0.65fr)_minmax(480px,1.35fr)] items-center gap-5 rounded-[20px] border border-[#64aced]/25 bg-[#253044]/55 p-5">
                <div>
                  <p className="mb-2 text-xs font-extrabold tracking-[0.1em] text-[#8dcdff] uppercase">
                    Работающие мышцы
                  </p>
                  <h3 className="my-2 text-2xl leading-tight font-black text-white text-balance">
                    Выбери прямо на силуэте
                  </h3>
                  <p className="m-0 text-sm leading-relaxed text-[#aebbd0] text-pretty">
                    Красная — основная, жёлтая — вторичная, третье нажатие
                    убирает выбор.
                  </p>
                </div>
                <MuscleMap
                  editable
                  profile={{
                    primary: form.primary_muscles
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                    secondary: form.secondary_muscles
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }}
                  onChange={(next) =>
                    setForm({
                      ...form,
                      primary_muscles: next.primary.join(", "),
                      secondary_muscles: next.secondary.join(", "),
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex min-h-[72px] flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.045] p-3">
                  <b className="w-full text-xs text-[#dbe7f5]">Основные</b>
                  {form.primary_muscles ? (
                    form.primary_muscles.split(",").map((name) => (
                      <span className="rounded-full border border-[#f44d59]/50 bg-[#ff4053]/10 px-2 py-1 text-xs text-[#ff9ca4]" key={name}>
                        {name.trim()}
                      </span>
                    ))
                  ) : (
                    <small className="text-xs text-[#7f8da1]">не выбраны</small>
                  )}
                </div>
                <div className="flex min-h-[72px] flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.045] p-3">
                  <b className="w-full text-xs text-[#dbe7f5]">Вторичные</b>
                  {form.secondary_muscles ? (
                    form.secondary_muscles
                      .split(",")
                      .map((name) => (
                        <span className="rounded-full border border-[#f7be41]/40 px-2 py-1 text-xs text-[#ffd679]" key={name}>
                          {name.trim()}
                        </span>
                      ))
                  ) : (
                    <small className="text-xs text-[#7f8da1]">не выбраны</small>
                  )}
                </div>
              </div>
              <label className={FORM_LABEL_CLASSES}>
                Описание / заметка
                <textarea
                  className={`${FORM_CONTROL_CLASSES} min-h-[110px] resize-y py-3`}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Техника, тренажёр, особенности…"
                />
              </label>
              {error && (
                <p className="my-1 rounded-xl border border-[#ff7699]/25 bg-[#ff7699]/10 px-3 py-2.5 text-sm leading-relaxed text-[#ffb5c8]">
                  {error}
                </p>
              )}
              <button
                disabled={isSaving}
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[13px] border border-[#7c6dff] bg-[linear-gradient(135deg,#7c6dff,#5c49ed)] px-5 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(109,93,252,0.27)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_15px_31px_rgba(109,93,252,0.36)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b91ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSaving ? "Сохраняю…" : "Сохранить"}
              </button>
            </form>
          </div>
        )}
      </div>
    </Shell>
  );
}
