// 规则：开新档、按时间推进（在线：客人进店；离线：招财罐攒钱）
import { find } from "./content.ts";
import { pick, random } from "./rng.ts";
import type { Cat, Content, DeviceEffect, GameState } from "./types.ts";

export const SAVE_VERSION = 1;
const HOUR = 3_600_000;

export function createGame(c: Content, now: number, seed = now): GameState {
  const b = c.balance;
  const s: GameState = {
    version: SAVE_VERSION,
    createdAt: now,
    time: now,
    rng: seed | 0,
    nextId: 1,
    coins: b.startCoins,
    hygiene: 100,
    ingredients: { ...b.startIngredients },
    supplies: { ...b.startSupplies },
    devices: [],
    furniture: [...b.startFurniture],
    learned: c.dishes.filter((d) => d.learnPrice === 0).map((d) => d.id),
    menu: [],
    stoves: [],
    counter: {},
    customers: [],
    nextCustomerAt: now,
    nextStrayAt: now + b.strayCheckMin * 60_000,
    stray: null,
    cats: [],
    piggy: 0,
    offlineMs: 0,
    stats: { served: 0, earned: 0 },
    log: [],
  };
  s.menu = [...s.learned];
  s.stoves = Array.from({ length: stoveCount(s, c) }, () => ({ dish: null, readyAt: 0 }));
  s.cats.push(newCat(s, b.starterCat, b.starterName, 80, 80));
  s.nextCustomerAt = now + customerInterval(s, c) * 1000;
  addLog(s, now, `哈基米餐厅开张了！${b.starterName}趴在柜台上打了个哈欠。`);
  return s;
}

export function newCat(s: GameState, breed: string, name: string, fullness: number, mood: number): Cat {
  return { uid: s.nextId++, breed, name, fullness, mood, affection: 0, lastPetAt: 0 };
}

export function addLog(s: GameState, t: number, text: string, c?: Content): void {
  s.log.push({ t, text });
  const max = c?.balance.logMax ?? 40;
  if (s.log.length > max) s.log.splice(0, s.log.length - max);
}

// ---------- 由存档算出来的数 ----------

export function mods(s: GameState, c: Content) {
  const m = { moodDecayMul: 1, hygieneDecayMul: 1, autoFeed: false, stoves: 0, offlineHoursAdd: 0, offlineRateMul: 1 };
  for (const id of s.devices) {
    const e: DeviceEffect = find(c.devices, id)?.effect ?? {};
    if (e.moodDecayMul) m.moodDecayMul *= e.moodDecayMul;
    if (e.hygieneDecayMul) m.hygieneDecayMul *= e.hygieneDecayMul;
    if (e.offlineRateMul) m.offlineRateMul *= e.offlineRateMul;
    if (e.autoFeed) m.autoFeed = true;
    m.stoves += e.stoves ?? 0;
    m.offlineHoursAdd += e.offlineHoursAdd ?? 0;
  }
  return m;
}

export function stoveCount(s: GameState, c: Content): number {
  return c.balance.baseStoves + mods(s, c).stoves;
}

export function isWorking(cat: Cat, c: Content): boolean {
  return cat.fullness >= c.balance.workMin && cat.mood >= c.balance.workMin;
}

export function shopStats(s: GameState, c: Content) {
  let seats = 0, appeal = 0, comfort = 0;
  for (const id of s.furniture) {
    const f = find(c.furniture, id);
    if (!f) continue;
    seats += f.seats; appeal += f.appeal; comfort += f.comfort;
  }
  const working = s.cats.filter((cat) => isWorking(cat, c));
  const catCharm = working.reduce((n, cat) => n + (find(c.cats, cat.breed)?.charm ?? 0), 0);
  return { seats, appeal, comfort, charm: appeal + catCharm, working: working.length };
}

export function offlineCapMs(s: GameState, c: Content): number {
  return (c.balance.offlineBaseHours + mods(s, c).offlineHoursAdd) * HOUR;
}

export function offlineRatePerHour(s: GameState, c: Content): number {
  const b = c.balance;
  const st = shopStats(s, c);
  const clean = 0.5 + 0.5 * (s.hygiene / 100);
  return (b.offlineBase + b.offlinePerCat * st.working + b.offlinePerAppeal * st.appeal) * clean * mods(s, c).offlineRateMul;
}

/** 下一位客人多少秒后来（不含随机波动） */
export function customerInterval(s: GameState, c: Content): number {
  const b = c.balance;
  let sec = Math.max(b.customerMinSec, b.customerBaseSec / (1 + shopStats(s, c).charm * b.charmFactor));
  if (s.hygiene < b.dirtyBelow) sec *= b.dirtyCustomerMul;
  return sec;
}

// ---------- 时间推进 ----------

export interface AdvanceReport { offlineMs: number; piggy: number; autoFed: number; stray: string | null }

/**
 * 把存档推进到 now。距上次推进超过 offlineAfterSec 算离线：
 * 客人先回家，店里只有猫和自动设备，收益进招财罐。
 * 直接修改 s。
 */
export function advance(s: GameState, now: number, c: Content): AdvanceReport | null {
  if (now <= s.time) return null;
  const b = c.balance;
  const gap = now - s.time;
  if (gap <= b.offlineAfterSec * 1000) {
    stepInChunks(s, now, 10_000, true, c);
    return null;
  }

  const report: AdvanceReport = { offlineMs: gap, piggy: 0, autoFed: 0, stray: null };
  if (s.customers.length) s.customers = [];
  const maxSim = b.maxSimulateHours * HOUR;
  if (gap > maxSim) {
    // 太久没来：前面那段不细算，直接跳
    s.time = now - maxSim;
    s.nextStrayAt = Math.max(s.nextStrayAt, s.time);
  }
  const piggyBefore = s.piggy;
  const strayBefore = s.stray;
  report.autoFed = stepInChunks(s, now, 10 * 60_000, false, c);
  report.piggy = Math.floor(s.piggy) - Math.floor(piggyBefore);
  if (s.stray && s.stray !== strayBefore) report.stray = s.stray;
  s.nextCustomerAt = now + customerInterval(s, c) * 1000;

  const hours = gap / HOUR;
  const parts = [`你离开了${hours >= 1 ? `约 ${hours.toFixed(1)} 小时` : `${Math.round(gap / 60_000)} 分钟`}`];
  if (report.piggy > 0) parts.push(`招财罐里多了 ${report.piggy} 枚金币`);
  if (report.autoFed > 0) parts.push(`自动猫粮机喂了 ${report.autoFed} 次`);
  addLog(s, now, parts.join("，") + "。", c);
  return report;
}

function stepInChunks(s: GameState, now: number, chunk: number, online: boolean, c: Content): number {
  let fed = 0;
  while (s.time < now) {
    const dt = Math.min(chunk, now - s.time);
    fed += step(s, dt, online, c);
    s.time += dt;
  }
  return fed;
}

function step(s: GameState, dt: number, online: boolean, c: Content): number {
  const b = c.balance;
  const m = mods(s, c);
  const h = dt / HOUR;
  const end = s.time + dt;
  let fed = 0;

  // 卫生
  const dirt = (b.hygieneDecayBase + b.hygieneDecayPerCat * s.cats.length) * m.hygieneDecayMul * h;
  s.hygiene = clamp(s.hygiene - dirt);

  // 猫：饿、闷；心情不会掉到家具舒适度以下
  const floor = Math.min(b.moodFloorMax, shopStats(s, c).comfort);
  for (const cat of s.cats) {
    cat.fullness = clamp(cat.fullness - b.fullnessDecay * h);
    if (m.autoFeed && cat.fullness < b.autoFeedBelow && (s.supplies.catfood ?? 0) > 0) {
      s.supplies.catfood--;
      cat.fullness = clamp(cat.fullness + (find(c.supplies, "catfood")?.effect.fullness ?? 50));
      fed++;
    }
    if (cat.mood > floor) cat.mood = Math.max(floor, cat.mood - b.moodDecay * m.moodDecayMul * h);
  }

  // 灶台：做好的菜放到出餐台
  for (const st of s.stoves) {
    if (st.dish && st.readyAt <= end) {
      s.counter[st.dish] = (s.counter[st.dish] ?? 0) + 1;
      st.dish = null;
    }
  }

  if (online) {
    // 客人：按排好的时间一个个来，没座位就下一位
    while (s.nextCustomerAt <= end) {
      const t = s.nextCustomerAt;
      if (s.menu.length && s.customers.length < shopStats(s, c).seats) {
        s.customers.push({ uid: s.nextId++, dish: pick(s, s.menu), arrivedAt: t });
      }
      s.nextCustomerAt = t + customerInterval(s, c) * (0.6 + 0.8 * random(s)) * 1000;
    }
  } else if (s.offlineMs < offlineCapMs(s, c)) {
    const used = Math.min(dt, offlineCapMs(s, c) - s.offlineMs);
    s.offlineMs += used;
    s.piggy += offlineRatePerHour(s, c) * (used / HOUR);
  }

  // 流浪猫：定时看一眼门口
  while (s.nextStrayAt <= end) {
    const t = s.nextStrayAt;
    s.nextStrayAt = t + b.strayCheckMin * 60_000;
    if (s.stray || s.cats.length >= b.maxCats) continue;
    const owned = new Set(s.cats.map((x) => x.breed));
    const wanted = new Set<string>();
    for (const id of s.furniture) for (const a of find(c.furniture, id)?.attracts ?? []) if (!owned.has(a)) wanted.add(a);
    if (wanted.size && random(s) < b.strayChance) {
      s.stray = pick(s, [...wanted]);
      const breed = find(c.cats, s.stray);
      addLog(s, t, `门口来了一只${breed?.name ?? "猫"}，探头探脑的。`, c);
    }
  }
  return fed;
}

export function clamp(x: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, x));
}
