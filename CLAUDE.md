# 哈基米餐厅 交接说明（给下一个会话的 Claude）

小月（项目主人，编程新手）的休闲经营游戏：可以撸猫的餐厅。她负责试玩、截图、反馈；代码都是你写。
协作约定同 kkssddd 仓库：中文、简洁、不说教、句首别加"哈"；命令要整段可复制并说明成功/失败长什么样；绝不让她贴密钥。

## 她确认过的玩法（2026-10-26）
- 参考：动物餐厅、猫咪后院。休闲，**不会亏钱倒闭**，照顾不好最多赚得少。
- **不要**"按真实时间营业 + 每日循环 + 结算界面"。在线时客人陆续来，钱当场进账。
- **要**离线收益：用时间戳算，进招财罐，有上限，点一下收。
- 做菜先简化：扣食材 → 放灶台烹饪一段时间 → 出餐台 → 上菜。
- 照顾猫要买东西：猫粮、罐头、猫砂、除臭剂（卫生）；自动设备（猫粮机、猫砂盆、净化器……）。
- 美术先放着，文字色块占位，跑通程序优先。
- 人机恋版：AI 伴侣用工具读真实店铺状态、帮忙操作；**小事直接做，花大钱先问她**。接到 kkssddd（她的聊天网页，分支 `claude/sleepy-ramanujan-6yfyup`，参考里面数独工具 sudoku_view/hint/place 的写法）。
- 普通版不依赖她的服务器，存档只在本地；以后做微信小程序。

## 结构
- `core/src/game.ts`：createGame、advance（在线每 ≤10 秒一步；距上次推进 >120 秒算离线，10 分钟一步，最多细算 48 小时）。
- `core/src/actions.ts`：act(state, action, now, content) → { state, ok, message }，**不改原存档**，message 是中文，AI 可直接转述。
- `core/src/describe.ts`：把存档写成中文，给 AI 工具用。
- `core/src/content.ts`：加载 JSON + checkContent（交叉校验 id，测试里会跑）。
- 随机数是存在存档里的 mulberry32，同样存档同样操作结果相同。
- 存档 `version` 字段，迁移写在 `save.ts` 的 fromJSON。
- Node ≥22.18 直接跑 .ts（只能用可擦除语法：不要 enum/namespace/参数属性；import 要带 .ts 后缀）。网页用 esbuild 打包。
- 店堂是一个画面（`web/src/scene.ts` + `layout.ts`）：她想要动物餐厅那种灶台会动、客人走进来、猫溜达的感觉。没有贴图，每样东西是带字的色块（橘猫就写"橘猫"），以后换贴图只改 scene.ts。猫的位置、客人走路这些只是画面，不进存档。
- `web/src/morph.ts`：每秒刷新只改变化的 DOM，避免按钮被替换导致点击丢失。别改回整块 innerHTML。

## 命令
`npm test`（core 测试）、`npm run check`（tsc）、`npm run dev`（localhost:8000）、`npm run build`（含单文件版 web/dist/hachimi.html）。

## 待办
- 人机恋版接入 kkssddd：服务器存档（她的 SQLite）、工具 hachimi_view / hachimi_act、操作权限分级、营业日记、主动消息联动。core 怎么进 kkssddd 还没定（倾向同步脚本复制，私有仓库直接 npm 安装要配 token）。
- 数值平衡还没在她手上验证过。
