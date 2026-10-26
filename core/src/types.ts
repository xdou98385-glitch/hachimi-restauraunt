// ---------- 内容（来自 core/data/*.json） ----------

export interface Ingredient { id: string; name: string; emoji: string; price: number }

export interface Dish {
  id: string; name: string; emoji: string;
  ingredients: Record<string, number>;
  cookSec: number; price: number;
  learnPrice: number; // 0 = 开局就会
}

export interface Supply {
  id: string; name: string; emoji: string; price: number;
  target: "cat" | "shop";
  effect: { fullness?: number; mood?: number; hygiene?: number };
  verb: string;
}

export interface DeviceEffect {
  moodDecayMul?: number; hygieneDecayMul?: number; autoFeed?: boolean;
  stoves?: number; offlineHoursAdd?: number; offlineRateMul?: number;
}
export interface Device { id: string; name: string; emoji: string; price: number; desc: string; requires?: string; effect: DeviceEffect }

export interface Furniture {
  id: string; name: string; emoji: string; price: number;
  seats: number; appeal: number; comfort: number; attracts: string[];
}

export interface CatBreed { id: string; name: string; emoji: string; color: string; charm: number; tipBonus: number; desc: string }

export interface Content {
  ingredients: Ingredient[]; dishes: Dish[]; supplies: Supply[];
  devices: Device[]; furniture: Furniture[]; cats: CatBreed[];
  balance: Balance;
}

// 数值平衡，全部在 balance.json 里调
export interface Balance {
  startCoins: number; startIngredients: Record<string, number>; startSupplies: Record<string, number>;
  startFurniture: string[]; starterCat: string; starterName: string;
  maxTables: number; maxDecor: number; maxCats: number; baseStoves: number;
  offlineAfterSec: number; offlineBaseHours: number; maxSimulateHours: number;
  offlineBase: number; offlinePerCat: number; offlinePerAppeal: number;
  customerBaseSec: number; customerMinSec: number; charmFactor: number;
  dirtyBelow: number; dirtyCustomerMul: number;
  tipFromHygiene: number; tipPerAffection: number; tipAffectionMax: number; tipWaitSec: number;
  hygieneDecayBase: number; hygieneDecayPerCat: number; hygienePerCustomer: number;
  fullnessDecay: number; moodDecay: number; moodFloorMax: number; workMin: number;
  autoFeedBelow: number; petMood: number; petCooldownSec: number;
  adoptFullness: number; adoptMood: number;
  strayCheckMin: number; strayChance: number; logMax: number;
}

// ---------- 存档（整个就是一个 JSON） ----------

export interface Cat {
  uid: number; breed: string; name: string;
  fullness: number; // 0-100 饱腹
  mood: number;     // 0-100 心情
  affection: number; // 亲密度，只涨不跌
  lastPetAt: number;
}

export interface Customer { uid: number; dish: string; arrivedAt: number }

export interface Stove { dish: string | null; readyAt: number }

export interface LogEntry { t: number; text: string }

export interface GameState {
  version: number;
  createdAt: number;
  time: number;        // 已经结算到的时间戳（毫秒）
  rng: number;         // 随机数种子状态
  nextId: number;
  coins: number;
  hygiene: number;     // 0-100
  ingredients: Record<string, number>;
  supplies: Record<string, number>;
  devices: string[];
  furniture: string[]; // 摆着的家具 id，可以重复
  learned: string[];   // 会做的菜
  menu: string[];      // 上架的菜
  stoves: Stove[];
  counter: Record<string, number>; // 出餐台上做好的菜
  customers: Customer[];
  nextCustomerAt: number;
  nextStrayAt: number;
  stray: string | null; // 门口的流浪猫品种
  cats: Cat[];
  piggy: number;       // 招财罐里攒的钱
  offlineMs: number;   // 本次离线已经计过收益的时长
  stats: { served: number; earned: number };
  log: LogEntry[];
}

export type Action =
  | { type: "buyIngredient"; id: string; qty: number }
  | { type: "buySupply"; id: string; qty: number }
  | { type: "buyDevice"; id: string }
  | { type: "buyFurniture"; id: string }
  | { type: "removeFurniture"; id: string }
  | { type: "learnDish"; id: string }
  | { type: "setMenu"; dishes: string[] }
  | { type: "cook"; dish: string }
  | { type: "serve"; customer: number }
  | { type: "useSupply"; id: string; cat?: number }
  | { type: "pet"; cat: number }
  | { type: "adopt"; name?: string }
  | { type: "rename"; cat: number; name: string }
  | { type: "collectPiggy" };

export interface ActResult { state: GameState; ok: boolean; message: string }
