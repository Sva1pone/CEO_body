import {
  Beef,
  Coffee,
  Cookie,
  Dumbbell,
  IceCream,
  Salad,
  Soup,
  Utensils,
} from "lucide-react";

export const MEAL_META = {
  Завтрак: { eyebrow: "Начало дня", icon: Coffee },
  Обед: { eyebrow: "Главный приём", icon: Utensils },
  Ужин: { eyebrow: "Финиш дня", icon: Soup },
  Перекус: { eyebrow: "По желанию", icon: Cookie },
};

export const ICONS = {
  soup: Soup,
  bowl: Utensils,
  burger: Beef,
  dumbbell: Dumbbell,
  cookie: Cookie,
  "ice-cream": IceCream,
  "cup-soda": Coffee,
  salad: Salad,
  utensils: Utensils,
};

const format = (value, digits = 0) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(
    Number(value || 0),
  );
