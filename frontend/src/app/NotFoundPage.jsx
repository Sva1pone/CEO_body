import React from "react";
import { ArrowLeft, MapPinOff } from "lucide-react";

import { Shell } from "../shared/ui";

export default function NotFoundPage() {
  return (
    <Shell cinematic>
      <main className="grid min-h-[calc(100vh-7rem)] place-items-center px-6 py-12 text-[#f4f7fc]">
        <section className="grid max-w-xl justify-items-center gap-5 rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(22,31,48,0.98),rgba(9,14,24,0.98))] p-10 text-center shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
          <span className="grid size-16 place-items-center rounded-2xl border border-[#67bfff]/35 bg-[#4ba9ef]/12 text-[#8ecbff]">
            <MapPinOff className="size-8" aria-hidden="true" />
          </span>
          <div className="grid gap-2">
            <p className="text-xs font-black tracking-[0.14em] text-[#9ed6ff] uppercase">
              Навигация
            </p>
            <h1 className="text-3xl font-black">Страница не найдена</h1>
            <p className="text-base leading-7 text-[#aebbd0]">
              Проверь адрес или вернись к плану на сегодня.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#3aa7ff] px-5 text-sm font-black text-[#07111d] transition hover:bg-[#70c5ff]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            На сегодня
          </a>
        </section>
      </main>
    </Shell>
  );
}
