import { useEffect, useRef, useState } from "react";

import { api } from "../../shared/api";
import { imageFileError } from "../../shared/imageUpload";
import { MUSCLE_LABELS } from "../../shared/MuscleMap";

function parseExerciseParameters(text) {
  const result = {};
  const aliases = {
    эффективность: "effectiveness_rating",
    сложность: "difficulty_rating",
    "основные мышцы": "primary_muscles",
    "рабочие группы": "primary_muscles",
    "вторичные мышцы": "secondary_muscles",
    "доп. рабочие группы": "secondary_muscles",
    "доп рабочие группы": "secondary_muscles",
  };
  const knownMuscles = new Set(
    Object.values(MUSCLE_LABELS).map((name) => name.toLowerCase()),
  );
  const errors = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const [rawKey, ...parts] = line.split(":");
    const key = aliases[rawKey.trim().toLowerCase()];
    if (!key) {
      errors.push(`Строка ${index + 1}: неизвестное поле «${rawKey.trim()}».`);
      return;
    }
    const value = parts.join(":").trim();
    if (key.endsWith("rating")) {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        errors.push(`Строка ${index + 1}: рейтинг должен быть от 1 до 5.`);
      else result[key] = rating;
    } else {
      const muscles = value
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      const unknown = muscles.filter(
        (name) => !knownMuscles.has(name.toLowerCase()),
      );
      if (unknown.length)
        errors.push(
          `Строка ${index + 1}: нет в справочнике — ${unknown.join(", ")}.`,
        );
      else result[key] = muscles.join(", ");
    }
  });
  return { result, errors };
}

export function useExerciseCatalog() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [activeTemplateId, setActiveTemplateId] = useState(
    () => Number(sessionStorage.getItem("exercise-template")) || 0,
  );
  const [activeSubgroupId, setActiveSubgroupId] = useState(
    () => Number(sessionStorage.getItem("exercise-subgroup")) || 0,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [subgroupMenuId, setSubgroupMenuId] = useState(null);
  const [dragUi, setDragUi] = useState(null);
  const [armingId, setArmingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const dragRef = useRef({ holdTimer: null, candidate: null, active: false });
  const blank = {
    name: "",
    muscle_group: "",
    template_ids: [],
    subgroup_ids: {},
    note: "",
    llm_block: "",
    effectiveness_rating: 3,
    difficulty_rating: 3,
    primary_muscles: "",
    secondary_muscles: "",
  };
  const [form, setForm] = useState(blank);
  const load = () =>
    api("/api/exercises")
      .then(setData)
      .catch((reason) => setError(reason.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!data?.templates.length) return;
    const template =
      data.templates.find((item) => item.id === activeTemplateId) ||
      data.templates[0];
    if (template.id !== activeTemplateId) setActiveTemplateId(template.id);
    const groups = data.subgroups.filter(
      (item) => item.template_id === template.id,
    );
    const subgroup =
      groups.find((item) => item.id === activeSubgroupId) || groups[0];
    if (subgroup && subgroup.id !== activeSubgroupId) {
      setActiveSubgroupId(subgroup.id);
      setCollapsed(Boolean(subgroup.collapsed));
    }
  }, [data, activeTemplateId, activeSubgroupId]);
  useEffect(() => {
    if (activeTemplateId)
      sessionStorage.setItem("exercise-template", String(activeTemplateId));
  }, [activeTemplateId]);
  useEffect(() => {
    if (activeSubgroupId)
      sessionStorage.setItem("exercise-subgroup", String(activeSubgroupId));
  }, [activeSubgroupId]);
  const currentTemplate = data?.templates.find(
    (item) => item.id === activeTemplateId,
  );
  const subgroups =
    data?.subgroups.filter((item) => item.template_id === activeTemplateId) ||
    [];
  const currentSubgroup = subgroups.find(
    (item) => item.id === activeSubgroupId,
  );
  const items = (data?.exercises || [])
    .filter((item) =>
      item.placements?.some(
        (placement) => placement.subgroup_id === activeSubgroupId,
      ),
    )
    .sort(
      (a, b) =>
        (a.placements.find((row) => row.subgroup_id === activeSubgroupId)
          ?.sort_order || 0) -
        (b.placements.find((row) => row.subgroup_id === activeSubgroupId)
          ?.sort_order || 0),
    );
  const displayedItems = dragUi
    ? items.filter((item) => item.id !== dragUi.item.id)
    : items;
  const selectTemplate = (id) => {
    setActiveTemplateId(id);
    setActiveSubgroupId(0);
    setCollapsed(false);
  };
  const openEditor = (item = null) => {
    setError("");
    setEditor(item || {});
    const subgroupIds = Object.fromEntries(
      (item?.placements || []).map((row) => [row.template_id, row.subgroup_id]),
    );
    setForm(
      item
        ? {
            name: item.name,
            muscle_group: item.muscle_group || "",
            template_ids: item.template_ids || [],
            subgroup_ids: subgroupIds,
            note: item.note || "",
            llm_block: "",
            effectiveness_rating: item.effectiveness_rating || 3,
            difficulty_rating: item.difficulty_rating || 3,
            primary_muscles: (item.muscle_profile?.primary || []).join(", "),
            secondary_muscles: (item.muscle_profile?.secondary || []).join(
              ", ",
            ),
          }
        : {
            ...blank,
            template_ids: activeTemplateId ? [activeTemplateId] : [],
            subgroup_ids:
              activeTemplateId && activeSubgroupId
                ? { [activeTemplateId]: activeSubgroupId }
                : {},
          },
    );
  };
  async function save(event) {
    event.preventDefault();
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    const payload = {
      ...form,
      primary_muscles: form.primary_muscles
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      secondary_muscles: form.secondary_muscles
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    try {
      setData(
        await api(
          editor?.id ? `/api/exercises/${editor.id}` : "/api/exercises",
          {
            method: editor?.id ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
        ),
      );
      setEditor(null);
    } catch (reason) {
      setError(reason.message);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }
  async function upload(item, file) {
    if (!file) return;
    const validationError = imageFileError(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    const body = new FormData();
    body.set("image", file);
    try {
      setData(
        await api(`/api/exercises/${item.id}/image`, { method: "POST", body }),
      );
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function archive(item) {
    if (
      !window.confirm(
        `Убрать «${item.name}» из каталога? Прошлые подходы останутся в истории.`,
      )
    )
      return;
    try {
      await api(`/api/exercises/${item.id}`, { method: "DELETE" });
      await load();
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function createSubgroup() {
    const name = window.prompt("Название новой подгруппы");
    if (!name?.trim()) return;
    try {
      const next = await api("/api/exercise-subgroups", {
        method: "POST",
        body: JSON.stringify({
          template_id: activeTemplateId,
          name: name.trim(),
        }),
      });
      setData(next);
      const created = next.subgroups.find(
        (row) =>
          row.template_id === activeTemplateId &&
          row.name.toLowerCase() === name.trim().toLowerCase(),
      );
      if (created) setActiveSubgroupId(created.id);
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function placeExercise(item, subgroupId, targetIndex) {
    try {
      const next = await api(`/api/exercises/${item.id}/placement`, {
        method: "PATCH",
        body: JSON.stringify({
          subgroup_id: subgroupId,
          target_index: targetIndex,
        }),
      });
      const commit = () => {
        setData(next);
        setDragUi(null);
      };
      if (document.startViewTransition) {
        const transition = document.startViewTransition(commit);
        await transition.finished.catch(() => {});
      } else commit();
      if (subgroupId !== activeSubgroupId) setError("");
    } catch (reason) {
      setDragUi(null);
      setError(reason.message);
    }
  }
  async function toggleSubgroup() {
    const nextValue = !collapsed;
    setCollapsed(nextValue);
    try {
      setData(
        await api(`/api/exercise-subgroups/${activeSubgroupId}`, {
          method: "PATCH",
          body: JSON.stringify({ collapsed: nextValue }),
        }),
      );
    } catch (reason) {
      setCollapsed(!nextValue);
      setError(reason.message);
    }
  }
  async function renameSubgroup(group) {
    const name = window.prompt("Новое название подгруппы", group.name);
    if (!name?.trim() || name.trim() === group.name) return;
    try {
      setData(
        await api(`/api/exercise-subgroups/${group.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim() }),
        }),
      );
      setSubgroupMenuId(null);
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function deleteSubgroup(group) {
    const count = data.exercises.filter((item) =>
      item.placements?.some((row) => row.subgroup_id === group.id),
    ).length;
    const alternatives = subgroups.filter((item) => item.id !== group.id);
    let destinationId = null;
    if (count) {
      if (!alternatives.length) {
        setError("Сначала создай другую подгруппу для переноса упражнений.");
        return;
      }
      const fallback = alternatives[0];
      const answer = window.prompt(
        `В «${group.name}» ${count} упражнений. Введи подгруппу назначения: ${alternatives.map((item) => item.name).join(", ")}`,
        "",
      );
      if (!answer?.trim()) return;
      const destination = alternatives.find(
        (item) => item.name.toLowerCase() === answer.trim().toLowerCase(),
      );
      if (!destination) {
        setError("Подгруппа назначения не найдена.");
        return;
      }
      destinationId = destination.id;
    } else if (!window.confirm(`Удалить пустую подгруппу «${group.name}»?`))
      return;
    try {
      const next = await api(`/api/exercise-subgroups/${group.id}`, {
        method: "DELETE",
        body: JSON.stringify({ destination_id: destinationId }),
      });
      setData(next);
      setSubgroupMenuId(null);
      if (activeSubgroupId === group.id)
        setActiveSubgroupId(destinationId || alternatives[0]?.id || 0);
    } catch (reason) {
      setError(reason.message);
    }
  }
  function beginCardHold(event, item, sourceIndex) {
    if (
      event.button !== 0 ||
      event.target.closest(
        "button,label,input,a,.exercise-photo-column,.exercise-row-map",
      )
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    const candidate = {
      item,
      sourceIndex,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      targetSubgroupId: activeSubgroupId,
      targetIndex: sourceIndex,
      slotAnchors: null,
    };
    clearTimeout(dragRef.current.holdTimer);
    setArmingId(item.id);
    dragRef.current = {
      candidate,
      active: false,
      holdTimer: setTimeout(() => {
        dragRef.current.active = true;
        setArmingId(null);
        setDragUi({ ...candidate, compact: false });
      }, 110),
    };
  }
  useEffect(() => {
    const movePointer = (event) => {
      const state = dragRef.current;
      if (!state.candidate) return;
      state.candidate.x = event.clientX;
      state.candidate.y = event.clientY;
      if (!state.active) {
        if (
          Math.hypot(
            event.clientX - state.candidate.startX,
            event.clientY - state.candidate.startY,
          ) > 8
        ) {
          clearTimeout(state.holdTimer);
          setArmingId(null);
          dragRef.current = { holdTimer: null, candidate: null, active: false };
        }
        return;
      }
      event.preventDefault();
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const subgroupNode = under?.closest("[data-subgroup-id]");
      const tabsRect = document
        .querySelector(".exercise-subgroup-tabs")
        ?.getBoundingClientRect();
      let targetSubgroupId = subgroupNode
        ? Number(subgroupNode.dataset.subgroupId)
        : activeSubgroupId;
      let targetIndex =
        targetSubgroupId === activeSubgroupId
          ? items.filter((item) => item.id !== state.candidate.item.id).length
          : data.exercises.filter((item) =>
              item.placements?.some(
                (row) => row.subgroup_id === targetSubgroupId,
              ),
            ).length;
      if (targetSubgroupId === activeSubgroupId) {
        if (!state.candidate.slotAnchors) {
          state.candidate.slotAnchors = [
            ...document.querySelectorAll(
              ".exercise-catalog-row[data-exercise-id]",
            ),
          ].map((node) => {
            const box = node.getBoundingClientRect();
            return box.top + box.height / 2;
          });
        }
        const anchors = state.candidate.slotAnchors;
        const proposed = anchors.findIndex((middle) => event.clientY < middle);
        const proposedIndex = proposed < 0 ? anchors.length : proposed;
        const currentIndex =
          state.candidate.targetSubgroupId === activeSubgroupId
            ? state.candidate.targetIndex
            : proposedIndex;
        targetIndex = currentIndex;
        if (proposedIndex > currentIndex) {
          const boundary = anchors[Math.min(currentIndex, anchors.length - 1)];
          if (boundary === undefined || event.clientY > boundary + 24)
            targetIndex = proposedIndex;
        } else if (proposedIndex < currentIndex) {
          const boundary = anchors[Math.min(proposedIndex, anchors.length - 1)];
          if (boundary === undefined || event.clientY < boundary - 24)
            targetIndex = proposedIndex;
        }
      }
      Object.assign(state.candidate, { targetSubgroupId, targetIndex });
      setDragUi({
        ...state.candidate,
        compact: Boolean(tabsRect && event.clientY < tabsRect.bottom + 120),
      });
    };
    const finishPointer = async () => {
      const state = dragRef.current;
      clearTimeout(state.holdTimer);
      setArmingId(null);
      const drop =
        state.active && state.candidate ? { ...state.candidate } : null;
      dragRef.current = { holdTimer: null, candidate: null, active: false };
      if (drop)
        await placeExercise(drop.item, drop.targetSubgroupId, drop.targetIndex);
      else setDragUi(null);
    };
    window.addEventListener("pointermove", movePointer, { passive: false });
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);
    return () => {
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
    };
  }, [items, activeSubgroupId, data]);
  function applyLlmBlock() {
    const parsed = parseExerciseParameters(form.llm_block);
    if (parsed.errors.length) {
      setError(parsed.errors.join(" "));
      return;
    }
    setError("");
    setForm({ ...form, ...parsed.result });
  }

  return {
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
  };
}
