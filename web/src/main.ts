// 普通版网页：存档只放浏览器本地（localStorage）
import {
  act, advance, createGame, defaultContent as c, find, fromJSON, isWorking, offlineCapMs,
  offlineRatePerHour, piggyFull, shopStats, toJSON,
} from "../../core/src/index.ts";
import type { Action, GameState } from "../../core/src/index.ts";
import { morph } from "./morph.ts";

const KEY = "hachimi-save";
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const put = (sel: string, html: string) => morph($(sel), html);
const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const r = Math.round;

let state: GameState = load();
let tab = "shop";
let shopTab = "ingredients";

function load(): GameState {
  const now = Date.now();
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      const s = fromJSON(text, c, now);
      const rep = advance(s, now, c);
      if (rep) setTimeout(() => toast(s.log[s.log.length - 1]?.text ?? ""), 300);
      return s;
    }
  } catch (e) {
    console.error(e);
    setTimeout(() => toast("存档读不出来，开了个新档"), 300);
  }
  return createGame(c, now, (Math.random() * 2 ** 31) | 0);
}

function save() {
  try { localStorage.setItem(KEY, toJSON(state)); } catch { /* 隐私模式之类，存不了就算了 */ }
}

function doAct(a: Action) {
  const res = act(state, a, Date.now(), c);
  state = res.state;
  toast(res.message, !res.ok);
  save();
  render();
}

let toastTimer = 0;
function toast(text: string, bad = false) {
  if (!text) return;
  const el = $("#toast");
  el.textContent = text;
  el.className = bad ? "show bad" : "show";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = ""), 2600);
}

const bar = (v: number) => `<span class="bar"><i style="width:${r(v)}%" class="${v < 30 ? "low" : ""}"></i></span>`;
const btn = (label: string, action: Action | null, extra = "") =>
  `<button ${action ? `data-act='${esc(JSON.stringify(action))}'` : "disabled"} ${extra}>${label}</button>`;

// ---------- 各个页面 ----------

function renderTop(now: number) {
  const full = piggyFull(state, c);
  put("#top", `
    <span class="coin">🪙 ${state.coins}</span>
    <span class="hyg">🧼 ${bar(state.hygiene)}</span>
    ${btn(`💰 ${Math.floor(state.piggy)}${full ? " 满" : ""}`, { type: "collectPiggy" }, `class="piggy" title="离线每小时攒 ${offlineRatePerHour(state, c).toFixed(1)}，最多 ${offlineCapMs(state, c) / 3_600_000} 小时"`)}`);
  void now;
}

function renderHall(now: number) {
  const st = shopStats(state, c);
  const dish = (id: string) => find(c.dishes, id)!;
  const customers = state.customers.map((cu) => {
    const d = dish(cu.dish);
    const ready = (state.counter[d.id] ?? 0) > 0;
    const wait = r((now - cu.arrivedAt) / 1000);
    return `<div class="card customer"><span class="big">🧑</span>
      <span>想吃 ${d.emoji} ${d.name}<small>等了 ${wait} 秒</small></span>
      ${btn("上菜", ready ? { type: "serve", customer: cu.uid } : null)}</div>`;
  }).join("") || `<p class="empty">${state.menu.length ? (st.seats ? "暂时没有客人，摸摸猫等一会儿吧" : "没有座位，去商店买张桌子") : "菜单是空的，客人不会来"}</p>`;

  const stoves = state.stoves.map((s, i) => {
    if (!s.dish) return `<div class="stove">🔥${i + 1} <small>空着</small></div>`;
    const d = dish(s.dish);
    const left = Math.max(0, (s.readyAt - now) / 1000);
    return `<div class="stove busy">${d.emoji} <small>${Math.ceil(left)} 秒</small>${bar(100 - (left / d.cookSec) * 100)}</div>`;
  }).join("");

  const counter = Object.entries(state.counter).map(([id, n]) => `${dish(id).emoji}×${n}`).join(" ") || "<small>空</small>";

  const cookBtns = state.menu.map((id) => {
    const d = dish(id);
    const enough = Object.entries(d.ingredients).every(([k, n]) => (state.ingredients[k] ?? 0) >= n);
    const need = Object.entries(d.ingredients).map(([k, n]) => `${find(c.ingredients, k)!.emoji}${n}`).join("");
    return btn(`${d.emoji} ${d.name}<small>${need} · ${d.cookSec}秒</small>`, enough ? { type: "cook", dish: id } : null, `class="cook"`);
  }).join("");

  const stray = state.stray ? find(c.cats, state.stray)! : null;
  put("#main", `
    ${stray ? `<div class="card stray"><span class="big">${stray.emoji}</span><span>门口有一只${stray.name}<small>${esc(stray.desc)}</small></span>${btn("收养", { type: "adopt" }, `data-adopt="1"`)}</div>` : ""}
    <h2>店堂 <small>座位 ${state.customers.length}/${st.seats} · 人气 ${st.charm}</small></h2>
    ${customers}
    <h2>厨房</h2>
    <div class="stoves">${stoves}</div>
    <p class="counter">出餐台：${counter}</p>
    <div class="cooks">${cookBtns}</div>`);
}

function renderCats(now: number) {
  const supplyBtns = (uid: number) => c.supplies.filter((s) => s.target === "cat")
    .map((s) => btn(`${s.emoji}<small>${state.supplies[s.id] ?? 0}</small>`, (state.supplies[s.id] ?? 0) > 0 ? { type: "useSupply", id: s.id, cat: uid } : null, `title="${s.name}"`)).join("");
  const cats = state.cats.map((cat) => {
    const b = find(c.cats, cat.breed)!;
    const cd = cat.lastPetAt + c.balance.petCooldownSec * 1000 - now;
    return `<div class="card cat">
      <span class="big">${b.emoji}</span>
      <div class="grow">
        <b data-rename="${cat.uid}" title="点名字改名">${esc(cat.name)}</b> <small>${b.name} · 亲密度 ${cat.affection}${isWorking(cat, c) ? "" : " · 没精神"}</small>
        <div class="stat">饱腹 ${bar(cat.fullness)}</div>
        <div class="stat">心情 ${bar(cat.mood)}</div>
      </div>
      <div class="acts">${btn(cd > 0 ? `🤚<small>${Math.ceil(cd / 60_000)}分</small>` : "🤚<small>摸摸</small>", cd > 0 ? null : { type: "pet", cat: cat.uid })}${supplyBtns(cat.uid)}</div>
    </div>`;
  }).join("");
  const shopSupplies = c.supplies.filter((s) => s.target === "shop")
    .map((s) => btn(`${s.emoji} ${s.name}<small>剩 ${state.supplies[s.id] ?? 0}</small>`, (state.supplies[s.id] ?? 0) > 0 ? { type: "useSupply", id: s.id } : null)).join("");
  put("#main", `
    <h2>猫咪 <small>${state.cats.length}/${c.balance.maxCats}</small></h2>${cats}
    <h2>打扫 <small>卫生 ${r(state.hygiene)}/100</small></h2><div class="row">${shopSupplies}</div>`);
}

function renderShop() {
  const tabs: [string, string][] = [["ingredients", "食材"], ["supplies", "用品"], ["furniture", "家具"], ["devices", "设备"], ["recipes", "菜谱"]];
  let body = "";
  if (shopTab === "ingredients" || shopTab === "supplies") {
    const isIng = shopTab === "ingredients";
    const list = isIng ? c.ingredients : c.supplies;
    const bag = isIng ? state.ingredients : state.supplies;
    const type = isIng ? "buyIngredient" : "buySupply";
    body = list.map((x) => `<div class="card item"><span class="big">${x.emoji}</span>
      <span class="grow">${x.name}<small>单价 ${x.price} · 有 ${bag[x.id] ?? 0}</small></span>
      ${btn("×1", state.coins >= x.price ? { type, id: x.id, qty: 1 } as Action : null)}
      ${btn("×5", state.coins >= x.price * 5 ? { type, id: x.id, qty: 5 } as Action : null)}</div>`).join("");
  } else if (shopTab === "furniture") {
    const placed = state.furniture.map((id) => find(c.furniture, id)!).map((f) =>
      `<button data-act='${esc(JSON.stringify({ type: "removeFurniture", id: f.id }))}' data-confirm="撤掉${f.name}？只退一半钱" class="chip">${f.emoji} ${f.name} ✕</button>`).join("");
    body = `<p class="hint">店里（${state.furniture.length}/${c.balance.maxFurniture}）：${placed || "空"}</p>` +
      c.furniture.map((f) => {
        const tags = [f.seats && `座位+${f.seats}`, f.appeal && `人气+${f.appeal}`, f.comfort && `舒适+${f.comfort}`,
          f.attracts.length && `会吸引${f.attracts.map((a) => find(c.cats, a)!.name).join("、")}`].filter(Boolean).join(" · ");
        return `<div class="card item"><span class="big">${f.emoji}</span><span class="grow">${f.name}<small>${tags}</small></span>
          ${btn(`🪙${f.price}`, state.coins >= f.price ? { type: "buyFurniture", id: f.id } : null)}</div>`;
      }).join("");
  } else if (shopTab === "devices") {
    body = c.devices.map((d) => {
      const has = state.devices.includes(d.id);
      const locked = d.requires && !state.devices.includes(d.requires);
      return `<div class="card item"><span class="big">${d.emoji}</span><span class="grow">${d.name}<small>${d.desc}</small></span>
        ${has ? "<small>已安装</small>" : btn(locked ? "🔒" : `🪙${d.price}`, !locked && state.coins >= d.price ? { type: "buyDevice", id: d.id } : null)}</div>`;
    }).join("");
  } else {
    body = c.dishes.map((d) => {
      const learned = state.learned.includes(d.id);
      const on = state.menu.includes(d.id);
      const need = Object.entries(d.ingredients).map(([k, n]) => `${find(c.ingredients, k)!.name}${n}`).join(" ");
      const toggle = on ? state.menu.filter((x) => x !== d.id) : [...state.menu, d.id];
      return `<div class="card item"><span class="big">${d.emoji}</span><span class="grow">${d.name}<small>${need} · ${d.cookSec}秒 · 卖 ${d.price}</small></span>
        ${learned ? btn(on ? "已上架" : "下架中", { type: "setMenu", dishes: toggle }, on ? `class="on"` : "")
          : btn(`学 🪙${d.learnPrice}`, state.coins >= d.learnPrice ? { type: "learnDish", id: d.id } : null)}</div>`;
    }).join("");
  }
  put("#main", `<div class="subtabs">${tabs.map(([k, v]) => `<button data-shop="${k}" class="${k === shopTab ? "on" : ""}">${v}</button>`).join("")}</div>${body}`);
}

function renderMore() {
  const log = [...state.log].reverse().map((l) =>
    `<li><small>${new Date(l.t).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small> ${esc(l.text)}</li>`).join("");
  put("#main", `
    <h2>店里发生的事</h2><ul class="log">${log}</ul>
    <h2>存档 <small>一共接待 ${state.stats.served} 位客人，赚了 ${state.stats.earned}</small></h2>
    <div class="row"><button data-export="1">导出存档</button><button data-import="1">导入存档</button><button data-reset="1" class="danger">重新开店</button></div>
    <textarea id="saveBox" placeholder="导出的存档会出现在这里；导入时把存档粘贴进来再点导入"></textarea>`);
}

function render() {
  const now = Date.now();
  renderTop(now);
  if (tab === "hall") renderHall(now);
  else if (tab === "cats") renderCats(now);
  else if (tab === "shop") renderShop();
  else renderMore();
  document.querySelectorAll<HTMLElement>("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
}

// ---------- 事件 ----------

document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest("button, [data-rename]") as HTMLElement | null;
  if (!el) return;
  const d = el.dataset;
  if (d.tab) { tab = d.tab; render(); return; }
  if (d.shop) { shopTab = d.shop; render(); return; }
  if (d.rename) {
    const cat = state.cats.find((x) => x.uid === Number(d.rename));
    const name = cat && prompt("给它起个新名字", cat.name);
    if (cat && name) doAct({ type: "rename", cat: cat.uid, name });
    return;
  }
  if (d.export) { ($("#saveBox") as HTMLTextAreaElement).value = toJSON(state); toast("存档在下面的框里，复制保存好"); return; }
  if (d.import) {
    try {
      const s = fromJSON(($("#saveBox") as HTMLTextAreaElement).value, c, Date.now());
      advance(s, Date.now(), c);
      state = s; save(); render(); toast("导入成功");
    } catch (err) { toast(`导入失败：${(err as Error).message}`, true); }
    return;
  }
  if (d.reset) {
    if (!confirm("确定重新开店？现在的存档会被清掉（想留着先导出）")) return;
    state = createGame(c, Date.now(), (Math.random() * 2 ** 31) | 0);
    save(); render(); toast("新店开张！");
    return;
  }
  if (d.act) {
    if (d.confirm && !confirm(d.confirm)) return;
    const a = JSON.parse(d.act) as Action;
    if (a.type === "adopt") {
      const breed = state.stray ? find(c.cats, state.stray) : null;
      const name = prompt("给它起个名字", breed?.name ?? "");
      if (name === null) return;
      a.name = name;
    }
    doAct(a);
  }
});

setInterval(() => {
  advance(state, Date.now(), c);
  render();
}, 1000);
setInterval(save, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  else { const rep = advance(state, Date.now(), c); if (rep) toast(state.log[state.log.length - 1].text); render(); }
});
window.addEventListener("pagehide", save);

tab = "hall";
save();
render();
