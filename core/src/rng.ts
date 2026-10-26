// mulberry32：种子存在存档里，同一个存档同样的操作结果一定相同
import type { GameState } from "./types.ts";

export function random(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pick<T>(s: GameState, list: T[]): T {
  return list[Math.floor(random(s) * list.length)];
}
