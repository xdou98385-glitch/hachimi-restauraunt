import { test } from "node:test";
import assert from "node:assert/strict";
import { act, advance, checkContent, createGame, defaultContent as c, describe, fromJSON, toJSON } from "../src/index.ts";
import type { Action, GameState } from "../src/index.ts";

const T0 = Date.UTC(2026, 9, 26, 2, 0, 0);
const SEC = 1000, MIN = 60_000, HOUR = 3_600_000;

function run(s: GameState, a: Action, now: number): GameState {
  const r = act(s, a, now, c);
  assert.ok(r.ok, r.message);
  return r.state;
}

// 模拟玩家开着页面：每秒推进一次
function playOnline(s: GameState, from: number, ms: number): number {
  for (let t = from + SEC; t <= from + ms; t += SEC) advance(s, t, c);
  return from + ms;
}

test("开局：有钱、有猫、有菜单、一个灶台", () => {
  const s = createGame(c, T0, 42);
  assert.equal(s.coins, 200);
  assert.equal(s.cats.length, 1);
  assert.equal(s.cats[0].name, "哈基米");
  assert.deepEqual(s.menu, ["onigiri", "tamago"]);
  assert.equal(s.stoves.length, 1);
});

test("做菜：扣食材 → 灶台计时 → 上出餐台 → 上菜收钱", () => {
  let s = createGame(c, T0, 42);
  s = run(s, { type: "cook", dish: "onigiri" }, T0 + SEC);
  assert.equal(s.ingredients.rice, 5);
  assert.equal(s.stoves[0].dish, "onigiri");
  assert.equal(act(s, { type: "cook", dish: "tamago" }, T0 + 2 * SEC, c).ok, false, "灶台被占");

  let now = playOnline(s, T0 + SEC, 60 * SEC);
  assert.equal(s.counter.onigiri, 1);
  assert.ok(s.customers.length > 0, "一分钟内应该来客人");

  const want = s.customers.find((x) => x.dish === "onigiri");
  if (want) {
    const before = s.coins;
    s = run(s, { type: "serve", customer: want.uid }, now);
    assert.ok(s.coins >= before + 10);
    assert.equal(s.stats.served, 1);
  }
});

test("食材不够做不了，钱不够买不了", () => {
  const s = createGame(c, T0, 1);
  const r = act(s, { type: "learnDish", id: "tempura" }, T0, c);
  assert.equal(r.ok, true);
  const r2 = act(r.state, { type: "cook", dish: "tempura" }, T0, c);
  assert.equal(r2.ok, false);
  assert.match(r2.message, /食材不够/);
  const r3 = act(r.state, { type: "buyDevice", id: "litterbox" }, T0, c);
  assert.equal(r3.ok, false);
  assert.match(r3.message, /钱不够/);
});

test("act 不修改原存档", () => {
  const s = createGame(c, T0, 1);
  const copy = toJSON(s);
  act(s, { type: "cook", dish: "onigiri" }, T0 + 5 * SEC, c);
  assert.equal(toJSON(s), copy);
});

test("离线：客人回家，招财罐攒钱，有上限", () => {
  const s = createGame(c, T0, 7);
  playOnline(s, T0, 30 * SEC);
  const rep = advance(s, T0 + 30 * SEC + 3 * HOUR, c);
  assert.ok(rep, "超过两分钟算离线");
  assert.equal(s.customers.length, 0);
  assert.ok(s.piggy > 10, `三小时应该攒了点钱：${s.piggy}`);

  const s2 = createGame(c, T0, 7);
  advance(s2, T0 + 40 * HOUR, c);
  const capped = s2.piggy;
  const s3 = createGame(c, T0, 7);
  advance(s3, T0 + 13 * HOUR, c);
  assert.ok(Math.abs(capped - s3.piggy) < 1e-6, "超过 12 小时不再涨");

  const r = act(s2, { type: "collectPiggy" }, T0 + 40 * HOUR, c);
  assert.equal(r.state.piggy < 1, true);
  assert.equal(r.state.coins, 200 + Math.floor(capped));
});

test("离线很久：猫饿了，但有自动猫粮机就能吃饱", () => {
  const plain = createGame(c, T0, 3);
  advance(plain, T0 + 10 * HOUR, c);
  assert.ok(plain.cats[0].fullness < 1);

  let fed = createGame(c, T0, 3);
  fed.coins = 1000;
  fed = run(fed, { type: "buyDevice", id: "feeder" }, T0);
  advance(fed, T0 + 10 * HOUR, c);
  assert.ok(fed.cats[0].fullness >= 30, `${fed.cats[0].fullness}`);
  assert.ok(fed.supplies.catfood < 5);
});

test("卫生会掉，换猫砂能补回来", () => {
  let s = createGame(c, T0, 3);
  advance(s, T0 + 10 * HOUR, c);
  const low = s.hygiene;
  assert.ok(low < 80);
  s = run(s, { type: "useSupply", id: "litter" }, T0 + 10 * HOUR);
  assert.ok(s.hygiene > low + 30);
});

test("摸猫：加心情和亲密度，有冷却", () => {
  let s = createGame(c, T0, 3);
  const uid = s.cats[0].uid;
  s = run(s, { type: "pet", cat: uid }, T0 + SEC);
  assert.equal(s.cats[0].affection, 1);
  assert.equal(act(s, { type: "pet", cat: uid }, T0 + 2 * SEC, c).ok, false);
});

test("摆了纸箱以外的猫家具，流浪猫迟早会来，可以收养", () => {
  let s = createGame(c, T0, 11);
  s = run(s, { type: "buyFurniture", id: "cushion" }, T0);
  advance(s, T0 + 12 * HOUR, c);
  assert.equal(s.stray, "calico");
  s = run(s, { type: "adopt", name: "小花" }, T0 + 12 * HOUR);
  assert.equal(s.cats.length, 2);
  assert.equal(s.cats[1].name, "小花");
  assert.equal(s.stray, null);
});

test("同样的存档、同样的操作，结果一样（AI 和玩家看到的一致）", () => {
  const a = createGame(c, T0, 99), b = createGame(c, T0, 99);
  playOnline(a, T0, 5 * MIN);
  playOnline(b, T0, 5 * MIN);
  assert.equal(toJSON(a), toJSON(b));
});

test("存档存取", () => {
  const s = createGame(c, T0, 5);
  const back = fromJSON(toJSON(s), c, T0);
  assert.deepEqual(back, s);
  assert.throws(() => fromJSON('{"hello":1}', c, T0));
});

test("describe 能写出店里的状况", () => {
  const s = createGame(c, T0, 5);
  const text = describe(s, T0, c);
  assert.match(text, /金币 200/);
  assert.match(text, /哈基米/);
});

test("JSON 数据互相引用的 id 都对得上", () => {
  assert.deepEqual(checkContent(c), []);
});
