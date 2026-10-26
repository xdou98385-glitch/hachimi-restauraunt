import ingredients from "../data/ingredients.json" with { type: "json" };
import dishes from "../data/dishes.json" with { type: "json" };
import supplies from "../data/supplies.json" with { type: "json" };
import devices from "../data/devices.json" with { type: "json" };
import furniture from "../data/furniture.json" with { type: "json" };
import cats from "../data/cats.json" with { type: "json" };
import balance from "../data/balance.json" with { type: "json" };
import type { Content } from "./types.ts";

// JSON 的形状 TypeScript 推不准，交给下面的 checkContent 兜底
export const defaultContent = { ingredients, dishes, supplies, devices, furniture, cats, balance } as unknown as Content;

export function find<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((x) => x.id === id);
}

/** 改完 JSON 跑一下 npm test，这里会指出写错的 id */
export function checkContent(c: Content): string[] {
  const errors: string[] = [];
  const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const ing = ids(c.ingredients), sup = ids(c.supplies), dev = ids(c.devices), fur = ids(c.furniture), cat = ids(c.cats);
  for (const [name, list] of Object.entries({ ingredients: c.ingredients, dishes: c.dishes, supplies: c.supplies, devices: c.devices, furniture: c.furniture, cats: c.cats })) {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) errors.push(`${name}.json 里 id「${x.id}」重复了`);
      seen.add(x.id);
    }
  }
  for (const d of c.dishes) for (const id of Object.keys(d.ingredients)) if (!ing.has(id)) errors.push(`菜「${d.name}」用到的食材「${id}」不存在`);
  for (const d of c.devices) if (d.requires && !dev.has(d.requires)) errors.push(`设备「${d.name}」依赖的「${d.requires}」不存在`);
  for (const f of c.furniture) for (const a of f.attracts) if (!cat.has(a)) errors.push(`家具「${f.name}」吸引的猫「${a}」不存在`);
  const b = c.balance;
  for (const id of Object.keys(b.startIngredients)) if (!ing.has(id)) errors.push(`开局食材「${id}」不存在`);
  for (const id of Object.keys(b.startSupplies)) if (!sup.has(id)) errors.push(`开局用品「${id}」不存在`);
  for (const id of b.startFurniture) if (!fur.has(id)) errors.push(`开局家具「${id}」不存在`);
  if (!cat.has(b.starterCat)) errors.push(`开局的猫「${b.starterCat}」不存在`);
  if (!sup.has("catfood")) errors.push("自动猫粮机要用 id 为 catfood 的用品");
  return errors;
}
