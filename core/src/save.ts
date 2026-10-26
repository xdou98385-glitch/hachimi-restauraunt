// 存档 = 一个 JSON 字符串。读的时候按版本号迁移、补齐缺的字段。
import { createGame, SAVE_VERSION } from "./game.ts";
import type { Content, GameState } from "./types.ts";

export function toJSON(s: GameState): string {
  return JSON.stringify(s);
}

export function fromJSON(text: string, c: Content, now: number): GameState {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || typeof raw.version !== "number") throw new Error("不是哈基米餐厅的存档");
  if (raw.version > SAVE_VERSION) throw new Error("存档来自更新的版本，请先更新游戏");
  // 以后改了存档结构，在这里按 raw.version 一步步迁移
  const fresh = createGame(c, now);
  return { ...fresh, ...raw, version: SAVE_VERSION, stats: { ...fresh.stats, ...raw.stats } };
}
