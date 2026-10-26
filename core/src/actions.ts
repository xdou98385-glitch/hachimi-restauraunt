// 玩家（或 AI 伴侣）的操作。act() 不改传进来的存档，返回新存档 + 一句中文结果。
import { find } from "./content.ts";
import { addLog, advance, clamp, isWorking, newCat, offlineCapMs, stoveCount } from "./game.ts";
import type { Action, ActResult, Content, GameState } from "./types.ts";

export function act(prev: GameState, action: Action, now: number, c: Content): ActResult {
  const s = structuredClone(prev);
  advance(s, now, c);
  const fail = (message: string): ActResult => ({ state: prev.time === s.time ? prev : s, ok: false, message });
  const done = (message: string, log = true): ActResult => {
    if (log) addLog(s, now, message, c);
    return { state: s, ok: true, message };
  };
  const pay = (cost: number) => {
    if (s.coins < cost) return false;
    s.coins -= cost;
    return true;
  };

  switch (action.type) {
    case "buyIngredient":
    case "buySupply": {
      const list = action.type === "buyIngredient" ? c.ingredients : c.supplies;
      const item = find<{ id: string; name: string; price: number }>(list, action.id);
      const qty = Math.floor(action.qty);
      if (!item) return fail(`没有「${action.id}」这种东西`);
      if (!(qty > 0)) return fail("数量要大于 0");
      const cost = item.price * qty;
      if (!pay(cost)) return fail(`钱不够：${item.name}×${qty} 要 ${cost}，现在只有 ${s.coins}`);
      const bag = action.type === "buyIngredient" ? s.ingredients : s.supplies;
      bag[item.id] = (bag[item.id] ?? 0) + qty;
      return done(`买了 ${item.name}×${qty}，花了 ${cost}`, false);
    }

    case "buyDevice": {
      const d = find(c.devices, action.id);
      if (!d) return fail(`没有「${action.id}」这种设备`);
      if (s.devices.includes(d.id)) return fail(`${d.name}已经有了`);
      if (d.requires && !s.devices.includes(d.requires)) return fail(`要先买${find(c.devices, d.requires)?.name ?? d.requires}`);
      if (!pay(d.price)) return fail(`钱不够：${d.name}要 ${d.price}，现在只有 ${s.coins}`);
      s.devices.push(d.id);
      while (s.stoves.length < stoveCount(s, c)) s.stoves.push({ dish: null, readyAt: 0 });
      return done(`装上了${d.name}`);
    }

    case "buyFurniture": {
      const f = find(c.furniture, action.id);
      if (!f) return fail(`没有「${action.id}」这种家具`);
      const isTable = f.seats > 0;
      const same = s.furniture.filter((id) => (find(c.furniture, id)?.seats ?? 0) > 0 === isTable).length;
      const max = isTable ? c.balance.maxTables : c.balance.maxDecor;
      if (same >= max) return fail(`${isTable ? "桌子" : "摆设"}最多 ${max} 件，先撤掉一件`);
      if (!pay(f.price)) return fail(`钱不够：${f.name}要 ${f.price}，现在只有 ${s.coins}`);
      s.furniture.push(f.id);
      return done(`摆上了${f.name}`);
    }

    case "removeFurniture": {
      const i = s.furniture.indexOf(action.id);
      const f = find(c.furniture, action.id);
      if (i < 0 || !f) return fail("店里没有这件家具");
      s.furniture.splice(i, 1);
      const back = Math.floor(f.price / 2);
      s.coins += back;
      return done(`撤掉了${f.name}，二手卖了 ${back}`);
    }

    case "learnDish": {
      const d = find(c.dishes, action.id);
      if (!d) return fail(`没有「${action.id}」这道菜`);
      if (s.learned.includes(d.id)) return fail(`${d.name}已经会做了`);
      if (!pay(d.learnPrice)) return fail(`钱不够：学${d.name}要 ${d.learnPrice}，现在只有 ${s.coins}`);
      s.learned.push(d.id);
      s.menu.push(d.id);
      return done(`学会了${d.name}，已经加进菜单`);
    }

    case "setMenu": {
      const bad = action.dishes.filter((id) => !s.learned.includes(id));
      if (bad.length) return fail(`还不会做：${bad.join("、")}`);
      s.menu = [...new Set(action.dishes)];
      const names = s.menu.map((id) => find(c.dishes, id)?.name ?? id);
      return done(s.menu.length ? `菜单改成：${names.join("、")}` : "菜单清空了，不会再有客人进来", false);
    }

    case "cook": {
      const d = find(c.dishes, action.dish);
      if (!d) return fail(`没有「${action.dish}」这道菜`);
      if (!s.learned.includes(d.id)) return fail(`还不会做${d.name}`);
      const stove = s.stoves.find((x) => !x.dish);
      if (!stove) return fail("灶台都占着，等一会儿");
      const missing = Object.entries(d.ingredients)
        .filter(([id, n]) => (s.ingredients[id] ?? 0) < n)
        .map(([id, n]) => `${find(c.ingredients, id)?.name ?? id}（要 ${n}，有 ${s.ingredients[id] ?? 0}）`);
      if (missing.length) return fail(`食材不够：${missing.join("、")}`);
      for (const [id, n] of Object.entries(d.ingredients)) s.ingredients[id] -= n;
      stove.dish = d.id;
      stove.readyAt = now + d.cookSec * 1000;
      return done(`${d.name}下锅了，${d.cookSec} 秒后好`, false);
    }

    case "serve": {
      const cu = s.customers.find((x) => x.uid === action.customer);
      if (!cu) return fail("没有这位客人");
      const d = find(c.dishes, cu.dish);
      if (!d) return fail("这位客人点的菜不存在");
      if (!s.counter[d.id]) return fail(`出餐台上没有${d.name}，先做一份`);
      s.counter[d.id]--;
      if (!s.counter[d.id]) delete s.counter[d.id];
      s.customers = s.customers.filter((x) => x !== cu);
      const earned = Math.round(d.price * (1 + tipRate(s, now - cu.arrivedAt, c)));
      s.coins += earned;
      s.hygiene = clamp(s.hygiene - c.balance.hygienePerCustomer);
      s.stats.served++;
      s.stats.earned += earned;
      return done(`上了${d.name}，收了 ${earned}`, false);
    }

    case "useSupply": {
      const sup = find(c.supplies, action.id);
      if (!sup) return fail(`没有「${action.id}」这种用品`);
      if (!(s.supplies[sup.id] > 0)) return fail(`${sup.name}用完了，先买点`);
      if (sup.target === "shop") {
        s.supplies[sup.id]--;
        s.hygiene = clamp(s.hygiene + (sup.effect.hygiene ?? 0));
        return done(`${sup.verb}，店里卫生 ${Math.round(s.hygiene)}`);
      }
      const cat = action.cat == null
        ? [...s.cats].sort((a, b) => a.fullness - b.fullness)[0]
        : s.cats.find((x) => x.uid === action.cat);
      if (!cat) return fail("没有这只猫");
      s.supplies[sup.id]--;
      cat.fullness = clamp(cat.fullness + (sup.effect.fullness ?? 0));
      cat.mood = clamp(cat.mood + (sup.effect.mood ?? 0));
      return done(`给${cat.name}${sup.verb}`);
    }

    case "pet": {
      const cat = s.cats.find((x) => x.uid === action.cat);
      if (!cat) return fail("没有这只猫");
      const wait = cat.lastPetAt + c.balance.petCooldownSec * 1000 - now;
      if (wait > 0) return fail(`${cat.name}刚被摸过，正在舔毛，${Math.ceil(wait / 60_000)} 分钟后再来`);
      cat.lastPetAt = now;
      cat.mood = clamp(cat.mood + c.balance.petMood);
      cat.affection++;
      return done(`摸了摸${cat.name}，它呼噜呼噜的（亲密度 ${cat.affection}）`);
    }

    case "adopt": {
      if (!s.stray) return fail("门口现在没有猫");
      if (s.cats.length >= c.balance.maxCats) return fail(`店里最多养 ${c.balance.maxCats} 只`);
      const breed = find(c.cats, s.stray);
      const name = action.name?.trim().slice(0, 12) || breed?.name || "猫";
      s.cats.push(newCat(s, s.stray, name, c.balance.adoptFullness, c.balance.adoptMood));
      s.stray = null;
      return done(`收养了一只${breed?.name ?? "猫"}，取名「${name}」`);
    }

    case "rename": {
      const cat = s.cats.find((x) => x.uid === action.cat);
      const name = action.name.trim().slice(0, 12);
      if (!cat) return fail("没有这只猫");
      if (!name) return fail("名字不能是空的");
      const old = cat.name;
      cat.name = name;
      return done(`${old}改名叫「${name}」了`);
    }

    case "collectPiggy": {
      const got = Math.floor(s.piggy);
      s.piggy -= got;
      s.offlineMs = 0;
      s.coins += got;
      s.stats.earned += got;
      return done(got ? `从招财罐里倒出 ${got} 枚金币` : "招财罐是空的", got > 0);
    }
  }
  return fail("不认识的操作");
}

export function tipRate(s: GameState, waitedMs: number, c: Content): number {
  const b = c.balance;
  let tip = b.tipFromHygiene * (s.hygiene / 100);
  for (const cat of s.cats) {
    if (!isWorking(cat, c)) continue;
    tip += find(c.cats, cat.breed)?.tipBonus ?? 0;
    tip += Math.min(b.tipAffectionMax, cat.affection * b.tipPerAffection);
  }
  if (waitedMs > b.tipWaitSec * 1000) tip *= 0.5;
  return tip;
}

export function piggyFull(s: GameState, c: Content): boolean {
  return s.offlineMs >= offlineCapMs(s, c);
}
