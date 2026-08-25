import React from "react";

const MUSCLE_ZONES = {
  грудь: "chest",
  "верх груди": "upper-chest",
  "передние дельты": "front-delts",
  "средние дельты": "side-delts",
  "задние дельты": "rear-delts",
  бицепс: "biceps",
  трицепс: "triceps",
  предплечья: "forearms",
  широчайшие: "lats",
  "верх спины": "upper-back",
  "середина спины": "upper-back",
  "верх трапеций": "traps",
  "разгибатели спины": "lower-back",
  кор: "core",
  ягодицы: "glutes",
  квадрицепсы: "quads",
  "задняя поверхность бедра": "hamstrings",
  икры: "calves",
};

export const MUSCLE_LABELS = {
  "front-delts": "передние дельты",
  "side-delts": "средние дельты",
  "rear-delts": "задние дельты",
  chest: "грудь",
  "upper-chest": "верх груди",
  biceps: "бицепс",
  triceps: "трицепс",
  forearms: "предплечья",
  core: "кор",
  quads: "квадрицепсы",
  calves: "икры",
  lats: "широчайшие",
  "upper-back": "верх спины",
  traps: "верх трапеций",
  "lower-back": "разгибатели спины",
  glutes: "ягодицы",
  hamstrings: "задняя поверхность бедра",
};

export default function MuscleMap({
  profile = {},
  compact = false,
  editable = false,
  onChange,
}) {
  const primary = profile.primary || [];
  const secondary = profile.secondary || [];
  const levelFor = (key) =>
    primary.some((name) => MUSCLE_ZONES[name] === key)
      ? "primary"
      : secondary.some((name) => MUSCLE_ZONES[name] === key)
        ? "secondary"
        : "";
  const toggle = (key) => {
    if (!editable || !onChange) return;
    const label = MUSCLE_LABELS[key];
    const clean = (items) => items.filter((name) => MUSCLE_ZONES[name] !== key);
    const current = levelFor(key);
    onChange({
      primary: current === "" ? [...clean(primary), label] : clean(primary),
      secondary:
        current === "primary" ? [...clean(secondary), label] : clean(secondary),
    });
  };
  const props = (key) => {
    const level = levelFor(key);
    const levelClasses =
      level === "primary"
        ? "fill-[#f04e57] stroke-[#ffc4c9] [filter:drop-shadow(0_0_3px_rgba(255,60,75,0.9))]"
        : level === "secondary"
          ? "fill-[#f3b947] stroke-[#ffe3a1] [filter:drop-shadow(0_0_3px_rgba(255,200,54,0.78))]"
          : "fill-[rgba(71,91,116,0.68)] stroke-[rgba(198,213,234,0.32)]";

    return {
    className: `muscle-shape ${key} stroke-[1.05px] transition-[fill,filter,stroke] duration-150 ${levelClasses} ${editable ? "cursor-pointer outline-none hover:fill-[#66b8ff] hover:stroke-[#e2f4ff] hover:[filter:drop-shadow(0_0_5px_rgba(77,175,255,0.9))] focus:fill-[#66b8ff] focus:stroke-[#e2f4ff] focus:[filter:drop-shadow(0_0_5px_rgba(77,175,255,0.9))]" : ""}`,
    onClick: () => toggle(key),
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") toggle(key);
    },
    role: editable ? "button" : undefined,
    tabIndex: editable ? 0 : undefined,
    "aria-label": `${MUSCLE_LABELS[key]}: ${levelFor(key) === "primary" ? "основная" : levelFor(key) === "secondary" ? "вторичная" : "не выбрана"}`,
    };
  };
  return (
    <figure
      className={`muscle-map relative m-0 aspect-[1.58/1] max-w-full overflow-hidden rounded-[14px] border bg-[radial-gradient(circle_at_50%_25%,#34445d,#131b29_76%)] ${compact ? "w-[300px] min-w-[300px]" : "w-[300px]"} ${editable ? "w-full max-w-[620px] border-[#59aeff]/50 shadow-[inset_0_0_35px_rgba(48,108,176,0.13)]" : "border-[#89b3e9]/30"}`}
    >
      <svg
        viewBox="0 0 430 270"
        role="img"
        aria-label="Анатомическая карта мышц спереди и сзади"
      >
        <defs>
          <linearGradient id="bodyTone" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#8493aa" />
            <stop offset="1" stopColor="#445168" />
          </linearGradient>
        </defs>
        <g
          className="stroke-[#aebbd0] stroke-[1.25px] opacity-[0.82] [stroke-linejoin:round]"
          fill="url(#bodyTone)"
        >
          <circle cx="106" cy="26" r="17" />
          <path d="M95 43 L89 51 C74 53 58 61 54 75 L45 111 L53 114 L67 82 L72 121 L79 155 L73 213 L84 249 L97 249 L101 205 L106 166 L111 205 L115 249 L128 249 L139 213 L133 155 L140 121 L145 82 L159 114 L167 111 L158 75 C154 61 138 53 123 51 L117 43 Z" />
          <circle cx="324" cy="26" r="17" />
          <path d="M313 43 L307 51 C292 53 276 61 272 75 L263 111 L271 114 L285 82 L290 121 L297 155 L291 213 L302 249 L315 249 L319 205 L324 166 L329 205 L333 249 L346 249 L357 213 L351 155 L358 121 L363 82 L377 114 L385 111 L376 75 C372 61 356 53 341 51 L335 43 Z" />
        </g>
        <g {...props("front-delts")}>
          <path d="M72 57 Q57 58 55 72 Q59 82 69 78 Q77 69 82 59Z" />
          <path d="M140 57 Q155 58 157 72 Q153 82 143 78 Q135 69 130 59Z" />
        </g>
        <g {...props("side-delts")}>
          <path d="M67 62 Q55 65 56 78 Q60 83 68 78 L74 66Z" />
          <path d="M145 62 Q157 65 156 78 Q152 83 144 78 L138 66Z" />
        </g>
        <g {...props("upper-chest")}>
          <path d="M80 61 Q93 54 104 61 L104 70 Q91 69 79 72Z" />
          <path d="M108 61 Q119 54 132 61 L133 72 Q121 69 108 70Z" />
        </g>
        <g {...props("chest")}>
          <path d="M79 70 Q91 65 104 71 L104 91 Q88 95 78 84Z" />
          <path d="M108 71 Q121 65 133 70 L134 84 Q124 95 108 91Z" />
        </g>
        <g {...props("biceps")}>
          <path d="M59 80 Q50 89 51 103 Q55 111 62 104 L68 82Z" />
          <path d="M153 80 Q162 89 161 103 Q157 111 150 104 L144 82Z" />
        </g>
        <g {...props("forearms")}>
          <path d="M51 104 L44 128 Q47 137 54 130 L61 106Z" />
          <path d="M161 104 L168 128 Q165 137 158 130 L151 106Z" />
        </g>
        <g {...props("core")}>
          <path d="M88 94 Q106 100 124 94 L127 128 Q119 143 106 146 Q93 143 85 128Z" />
          <path
            d="M105 98 V143 M89 109 H123 M87 123 H125"
            className="pointer-events-none fill-none stroke-[rgba(230,237,248,0.38)] stroke-[0.8px]"
          />
        </g>
        <g {...props("quads")}>
          <path d="M81 153 Q88 143 103 153 L100 202 Q92 216 79 205Z" />
          <path d="M109 153 Q124 143 131 153 L133 205 Q120 216 112 202Z" />
        </g>
        <g {...props("calves")}>
          <path d="M78 207 Q88 201 98 210 L94 242 Q86 251 79 240Z" />
          <path d="M114 210 Q124 201 134 207 L133 240 Q126 251 118 242Z" />
          <path d="M296 207 Q306 201 316 210 L312 242 Q304 251 297 240Z" />
          <path d="M332 210 Q342 201 352 207 L351 240 Q344 251 336 242Z" />
        </g>
        <g {...props("rear-delts")}>
          <path d="M290 57 Q275 58 273 72 Q277 81 287 77 L299 59Z" />
          <path d="M358 57 Q373 58 375 72 Q371 81 361 77 L349 59Z" />
        </g>
        <g {...props("traps")}>
          <path d="M307 52 L316 43 L324 59 L332 43 L341 52 L349 67 Q324 76 299 67Z" />
        </g>
        <g {...props("upper-back")}>
          <path d="M298 65 Q324 55 350 65 L345 91 Q324 103 303 91Z" />
        </g>
        <g {...props("lats")}>
          <path d="M294 75 Q306 82 319 94 L315 124 Q300 116 290 101Z" />
          <path d="M354 75 Q342 82 329 94 L333 124 Q348 116 358 101Z" />
        </g>
        <g {...props("triceps")}>
          <path d="M278 80 Q269 90 270 105 Q275 112 281 103 L287 81Z" />
          <path d="M370 80 Q379 90 378 105 Q373 112 367 103 L361 81Z" />
        </g>
        <g {...props("lower-back")}>
          <path d="M314 101 Q324 96 334 101 L337 132 Q324 143 311 132Z" />
        </g>
        <g {...props("glutes")}>
          <path d="M298 137 Q311 127 323 140 L322 157 Q308 166 296 154Z" />
          <path d="M325 140 Q337 127 350 137 L352 154 Q340 166 326 157Z" />
        </g>
        <g {...props("hamstrings")}>
          <path d="M299 159 Q310 151 321 160 L316 204 Q307 215 297 205Z" />
          <path d="M327 160 Q338 151 349 159 L351 205 Q341 215 332 204Z" />
        </g>
        <text
          className="fill-[#d6e1f1] text-[8px] tracking-[0.7px] uppercase"
          x="106"
          y="263"
          textAnchor="middle"
        >
          СПЕРЕДИ
        </text>
        <text
          className="fill-[#d6e1f1] text-[8px] tracking-[0.7px] uppercase"
          x="324"
          y="263"
          textAnchor="middle"
        >
          СЗАДИ
        </text>
      </svg>
      {!editable && (
        <figcaption className="absolute right-[5px] bottom-[3px] left-[5px] flex items-center gap-1.5 text-[8px] text-[#f5f7ff] [text-shadow:0_1px_3px_#000]">
          <span className="inline-block size-[7px] rounded-full bg-[#ff4848] shadow-[0_0_8px_#ff3a3a]" />
          основные
          <span className="inline-block size-[7px] rounded-full bg-[#f6c348] shadow-[0_0_8px_#ffc53d]" />
          вторичные
        </figcaption>
      )}
    </figure>
  );
}
