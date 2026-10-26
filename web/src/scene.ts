// 店里的画面：灶台、出餐台、桌子、客人、猫。
// 现在没有贴图，每样东西是一个带字的色块（橘猫就写"橘猫"）。以后换贴图只改这里。
import { find, isWorking } from "../../core/src/index.ts";
import type { Action, Content, GameState } from "../../core/src/index.ts";
import * as L from "./layout.ts";

const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const actAttr = (a: Action) => JSON.stringify(a); // 直接写 dataset，不用转义

interface CatMove { x: number; y: number; next: number }

export class Scene {
  private els = new Map<string, HTMLElement>();
  private html = new Map<string, string>();
  private pos = new Map<string, L.P>();
  private seen = new Set<string>();
  private cats = new Map<number, CatMove>();
  private seatOf = new Map<number, number>();
  private present = new Map<number, string>(); // 上一帧在店里的客人 → 点的菜
  private leaving = new Map<number, number>(); // 正在离开的客人 → 开始离开的时间
  private root: HTMLElement;
  private c: Content;

  constructor(root: HTMLElement, c: Content) {
    this.root = root;
    this.c = c;
    root.innerHTML = `<div class="wall"></div><div class="s door" style="left:${L.DOOR.x}%;top:${L.DOOR.y}%"><b>门</b></div>`;
  }

  /** 某样东西现在在哪（给飘字用） */
  where(key: string): L.P | undefined {
    return this.pos.get(key);
  }

  fx(text: string, key: string, cls = "") {
    const p = this.pos.get(key);
    if (!p) return;
    const e = document.createElement("div");
    e.className = `fx ${cls}`;
    e.textContent = text;
    e.style.left = `${p.x}%`;
    e.style.top = `${p.y - 6}%`;
    this.root.appendChild(e);
    setTimeout(() => e.remove(), 1400);
  }

  update(s: GameState, now: number) {
    const c = this.c;
    this.seen.clear();

    // 灶台
    s.stoves.forEach((st, i) => {
      const e = this.el(`stove${i}`, L.STOVES[i] ?? L.STOVES[0],
        `<b></b><small></small><span class="flames"><i></i><i></i><i></i></span><span class="steam"><i></i><i></i><i></i></span><span class="prog"><i></i></span>`);
      const d = st.dish ? find(c.dishes, st.dish) : null;
      e.className = `s stove${d ? " busy" : ""}`;
      e.querySelector("b")!.textContent = d ? d.name : "灶台";
      const left = d ? Math.max(0, Math.ceil((st.readyAt - now) / 1000)) : 0;
      e.querySelector("small")!.textContent = d ? `${left} 秒` : "空着";
      (e.querySelector(".prog i") as HTMLElement).style.width = d ? `${100 - (left / d.cookSec) * 100}%` : "0";
      e.dataset.stove = "1";
    });

    // 出餐台
    const dishes = Object.entries(s.counter).map(([id, n]) => `<span class="tag">${esc(find(c.dishes, id)?.name ?? id)}${n > 1 ? `×${n}` : ""}</span>`).join("");
    this.el("counter", L.COUNTER, `<b>出餐台</b><div class="tags">${dishes || "<small>空</small>"}</div>`).className = "s counter";

    // 招财罐、食盆、猫砂盆
    const piggy = this.el("piggy", L.PIGGY, `<b>招财罐</b><small>${Math.floor(s.piggy)}</small>`);
    piggy.className = `s piggy${s.piggy >= 1 ? " has" : ""}`;
    piggy.dataset.act = actAttr({ type: "collectPiggy" });

    const food = s.supplies.catfood ?? 0;
    const bowl = this.el("bowl", L.BOWL, `<b>食盆</b><small>猫粮 ${food}</small>`);
    bowl.className = "s bowl";
    if (food > 0) { bowl.dataset.act = actAttr({ type: "useSupply", id: "catfood" }); delete bowl.dataset.hint; }
    else { bowl.dataset.hint = "猫粮吃完了，去商店买"; delete bowl.dataset.act; }

    const litter = this.el("litter", L.LITTER, `<b>猫砂盆</b>${s.hygiene < 50 ? `<em>臭</em>` : ""}`);
    litter.className = "s litter";
    if ((s.supplies.litter ?? 0) > 0) { litter.dataset.act = actAttr({ type: "useSupply", id: "litter" }); delete litter.dataset.hint; }
    else { litter.dataset.hint = "猫砂用完了，去商店买"; delete litter.dataset.act; }

    // 地上脏了
    const dirt = s.hygiene < 70 ? Math.min(L.DIRT.length, Math.ceil((70 - s.hygiene) / 10)) : 0;
    for (let i = 0; i < dirt; i++) {
      const e = this.el(`dirt${i}`, L.DIRT[i], "脏");
      e.className = "s dirt";
      if ((s.supplies.deodorant ?? 0) > 0) { e.dataset.act = actAttr({ type: "useSupply", id: "deodorant" }); delete e.dataset.hint; }
      else { e.dataset.hint = "喷点除臭剂吧（商店 → 用品）"; delete e.dataset.act; }
    }

    // 家具：桌子一类，摆设一类
    const seats: L.P[] = [];
    let ti = 0, di = 0;
    for (const id of s.furniture) {
      const f = find(c.furniture, id);
      if (!f) continue;
      if (f.seats > 0) {
        const p = L.TABLES[ti];
        if (!p) continue;
        this.el(`table${ti}:${id}`, p, `<b>${esc(f.name)}</b>`).className = "s table";
        seats.push(...L.seatsAround(p, f.seats));
        ti++;
      } else {
        const p = L.DECOR[di];
        if (!p) continue;
        this.el(`decor${di}:${id}`, p, `<b>${esc(f.name)}</b>`).className = "s decor";
        di++;
      }
    }

    // 客人：从门口走到座位
    const here = new Set(s.customers.map((cu) => cu.uid));
    for (const uid of [...this.seatOf.keys()]) if (!here.has(uid)) this.seatOf.delete(uid);
    const taken = new Set(this.seatOf.values());
    for (const cu of s.customers) {
      let seat = this.seatOf.get(cu.uid);
      if (seat == null || seat >= seats.length) {
        seat = seats.findIndex((_, i) => !taken.has(i));
        if (seat < 0) continue;
        this.seatOf.set(cu.uid, seat);
        taken.add(seat);
      }
      const d = find(c.dishes, cu.dish);
      const ready = (s.counter[cu.dish] ?? 0) > 0;
      const e = this.el(`cu${cu.uid}`, seats[seat], `<span class="body">客人</span><span class="bubble">${esc(d?.name ?? "?")}</span>`, L.DOOR);
      e.className = `s guest${ready ? " ready" : ""}`;
      if (ready) { e.dataset.act = actAttr({ type: "serve", customer: cu.uid }); delete e.dataset.hint; }
      else { e.dataset.hint = `还没有${d?.name ?? "这道菜"}，先去灶台做一份`; delete e.dataset.act; }
    }
    // 刚走的客人：先说句话，再走回门口
    for (const uid of this.present.keys()) if (!here.has(uid) && !this.leaving.has(uid)) this.leaving.set(uid, now);
    for (const [uid, since] of this.leaving) {
      const key = `cu${uid}`;
      const e = this.els.get(key);
      if (!e || now - since > 3200) { this.leaving.delete(uid); continue; }
      this.seen.add(key);
      e.className = "s guest leaving";
      delete e.dataset.act;
      delete e.dataset.hint;
      const b = e.querySelector(".bubble");
      if (b) b.textContent = "好吃～";
      if (now - since > 1200) this.move(key, e, L.DOOR);
    }
    this.present = new Map(s.customers.map((cu) => [cu.uid, cu.dish]));

    // 猫：到处溜达；饿了去食盆，没精神就找个地方睡
    const comfy = s.furniture.flatMap((id, i) => {
      const f = find(c.furniture, id);
      return f && f.seats === 0 ? [{ f, i }] : [];
    });
    for (const cat of s.cats) {
      const breed = find(c.cats, cat.breed);
      const hungry = cat.fullness < c.balance.workMin;
      const sleepy = !hungry && !isWorking(cat, c);
      let m = this.cats.get(cat.uid);
      if (!m) { m = { ...this.randomSpot(), next: 0 }; this.cats.set(cat.uid, m); }
      if (now >= m.next) {
        let target: L.P = this.randomSpot();
        if (hungry) target = { x: L.BOWL.x + 2, y: L.BOWL.y + 9 };
        else {
          const liked = comfy.filter(({ f }) => f.attracts.includes(cat.breed) || f.comfort > 0);
          if (liked.length && Math.random() < (sleepy ? 0.9 : 0.3)) {
            const pick = liked[Math.floor(Math.random() * liked.length)];
            const di2 = comfy.indexOf(pick);
            const p = L.DECOR[di2];
            if (p) target = { x: p.x, y: p.y - 5 };
          }
        }
        m.x = target.x; m.y = target.y;
        m.next = now + (sleepy ? 20_000 : 4000 + Math.random() * 6000);
      }
      const color = breed?.color ?? "#ccc";
      const mark = hungry ? `<em>饿</em>` : sleepy ? `<em class="zz">Zz</em>` : "";
      const e = this.el(`cat${cat.uid}`, m,
        `<span class="body" style="--c:${color};color:${ink(color)}">${esc(breed?.name ?? "猫")}</span><small>${esc(cat.name)}</small>${mark}`);
      e.className = `s cat${sleepy ? " sleep" : ""}`;
      e.dataset.act = actAttr({ type: "pet", cat: cat.uid });
    }
    for (const uid of [...this.cats.keys()]) if (!s.cats.some((x) => x.uid === uid)) this.cats.delete(uid);

    // 门口的流浪猫
    if (s.stray) {
      const breed = find(c.cats, s.stray);
      const color = breed?.color ?? "#ccc";
      const e = this.el(`stray:${s.stray}`, L.STRAY,
        `<span class="body" style="--c:${color};color:${ink(color)}">${esc(breed?.name ?? "猫")}</span><span class="bubble">收养?</span>`, { x: 104, y: L.STRAY.y });
      e.className = "s cat stray";
      e.dataset.adopt = "1";
    }

    // 不在了的东西删掉
    for (const [key, e] of this.els) {
      if (this.seen.has(key)) continue;
      e.remove();
      this.els.delete(key);
      this.html.delete(key);
      this.pos.delete(key);
    }
  }

  private randomSpot(): L.P {
    const w = L.WANDER;
    return { x: w.x0 + Math.random() * (w.x1 - w.x0), y: w.y0 + Math.random() * (w.y1 - w.y0) };
  }

  /** 拿到（或新建）一个元素，放到 p；新建时可以从 from 走过来 */
  private el(key: string, p: L.P, html: string, from?: L.P): HTMLElement {
    let e = this.els.get(key);
    if (!e) {
      e = document.createElement("div");
      this.root.appendChild(e);
      this.els.set(key, e);
      if (from) {
        this.place(key, e, from);
        void e.offsetWidth; // 先停在起点，下一帧再走
      }
    }
    if (this.html.get(key) !== html && !key.startsWith("stove") || !this.html.has(key)) {
      e.innerHTML = html;
      this.html.set(key, html);
    }
    this.seen.add(key);
    this.move(key, e, p);
    return e;
  }

  private move(key: string, e: HTMLElement, p: L.P) {
    const old = this.pos.get(key);
    if (old && old.x === p.x && old.y === p.y) return;
    this.place(key, e, p);
  }

  private place(key: string, e: HTMLElement, p: L.P) {
    e.style.left = `${p.x}%`;
    e.style.top = `${p.y}%`;
    e.style.zIndex = String(10 + Math.round(p.y));
    this.pos.set(key, { ...p });
  }
}

/** 浅色底配深字，深色底配浅字 */
function ink(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#3b302a" : "#fffaf3";
}
