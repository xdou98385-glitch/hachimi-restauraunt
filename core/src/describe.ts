// 把存档写成一段中文，给 AI 伴侣的工具用（也方便调试）
import { piggyFull } from "./actions.ts";
import { find } from "./content.ts";
import { customerInterval, isWorking, offlineRatePerHour, shopStats } from "./game.ts";
import type { Content, GameState } from "./types.ts";

const r = Math.round;

export function describe(s: GameState, now: number, c: Content): string {
  const name = (list: { id: string; name: string }[], id: string) => find(list, id)?.name ?? id;
  const bag = (rec: Record<string, number>, list: { id: string; name: string }[]) =>
    Object.entries(rec).filter(([, n]) => n > 0).map(([id, n]) => `${name(list, id)}×${n}`).join("、") || "空";
  const st = shopStats(s, c);
  const lines: string[] = [];

  lines.push(`金币 ${s.coins}；招财罐 ${Math.floor(s.piggy)}${piggyFull(s, c) ? "（满了）" : ""}；卫生 ${r(s.hygiene)}/100`);
  lines.push(`座位 ${st.seats}，人气 ${st.charm}，大约每 ${r(customerInterval(s, c))} 秒来一位客人；离线每小时攒 ${offlineRatePerHour(s, c).toFixed(1)}`);
  lines.push(`菜单：${s.menu.map((id) => name(c.dishes, id)).join("、") || "空（不会有客人）"}`);
  const unlearned = c.dishes.filter((d) => !s.learned.includes(d.id)).map((d) => `${d.name}(${d.learnPrice})`);
  if (unlearned.length) lines.push(`还没学的菜：${unlearned.join("、")}`);
  lines.push(`食材：${bag(s.ingredients, c.ingredients)}`);
  lines.push(`用品：${bag(s.supplies, c.supplies)}`);
  lines.push(`灶台：${s.stoves.map((x, i) => `${i + 1}号${x.dish ? `${name(c.dishes, x.dish)}还要 ${Math.max(0, r((x.readyAt - now) / 1000))} 秒` : "空"}`).join("；")}`);
  lines.push(`出餐台：${bag(s.counter, c.dishes)}`);
  lines.push(s.customers.length
    ? `等餐的客人：${s.customers.map((x) => `#${x.uid} 要${name(c.dishes, x.dish)}（等了 ${r((now - x.arrivedAt) / 1000)} 秒）`).join("；")}`
    : "现在没有客人在等");
  lines.push("猫：");
  for (const cat of s.cats) {
    const breed = find(c.cats, cat.breed);
    lines.push(`  #${cat.uid} ${cat.name}（${breed?.name ?? cat.breed}）饱腹 ${r(cat.fullness)} 心情 ${r(cat.mood)} 亲密度 ${cat.affection}${isWorking(cat, c) ? "" : " ——没精神，不招客"}`);
  }
  if (s.stray) lines.push(`门口有一只流浪的${name(c.cats, s.stray)}，可以收养`);
  lines.push(`家具：${s.furniture.map((id) => name(c.furniture, id)).join("、") || "无"}`);
  lines.push(`设备：${s.devices.map((id) => name(c.devices, id)).join("、") || "无"}`);
  const recent = s.log.slice(-5).map((l) => `  ${new Date(l.t).toISOString().slice(5, 16).replace("T", " ")} ${l.text}`);
  if (recent.length) lines.push("最近发生的事（UTC 时间）：", ...recent);
  return lines.join("\n");
}
