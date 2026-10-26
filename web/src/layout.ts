// 店里各样东西的位置，单位是场景宽/高的百分比
export interface P { x: number; y: number }

export const KITCHEN_BOTTOM = 19;
export const DOOR: P = { x: 91, y: 10 };
export const STRAY: P = { x: 91, y: 28 };
export const STOVES: P[] = [{ x: 10, y: 9 }, { x: 26, y: 9 }, { x: 42, y: 9 }];
export const COUNTER: P = { x: 66, y: 9 };
export const PIGGY: P = { x: 66, y: 26 };
export const BOWL: P = { x: 8, y: 44 };
export const LITTER: P = { x: 8, y: 62 };

export const TABLES: P[] = [
  { x: 31, y: 40 }, { x: 73, y: 40 },
  { x: 31, y: 58 }, { x: 73, y: 58 },
  { x: 31, y: 76 }, { x: 73, y: 76 },
];

// 摆设：中间一列 + 最下面一排
export const DECOR: P[] = [
  { x: 52, y: 49 }, { x: 52, y: 67 },
  { x: 10, y: 92 }, { x: 26, y: 92 }, { x: 42, y: 92 }, { x: 58, y: 92 }, { x: 74, y: 92 }, { x: 90, y: 92 },
];

/** 一张桌子周围的座位 */
export function seatsAround(t: P, n: number): P[] {
  const all = [{ x: t.x - 12, y: t.y }, { x: t.x + 12, y: t.y }, { x: t.x, y: t.y + 8 }, { x: t.x, y: t.y - 7 }];
  return all.slice(0, n);
}

/** 猫随便溜达的范围 */
export const WANDER = { x0: 16, x1: 86, y0: 30, y1: 86 };

// 地上脏的地方（卫生越低出现得越多）
export const DIRT: P[] = [{ x: 44, y: 36 }, { x: 62, y: 70 }, { x: 20, y: 84 }, { x: 84, y: 50 }, { x: 40, y: 64 }, { x: 66, y: 32 }];
