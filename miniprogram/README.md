# 微信小程序（还没做）

计划：用 esbuild 把 `core/src/index.ts` 打包成一个 JS 文件放进小程序，存档用 `wx.setStorageSync("hachimi-save", toJSON(state))`。
core 里没有用到浏览器或 Node 专属的东西（只用了 `structuredClone`，小程序基础库不支持的话换成 `JSON.parse(JSON.stringify(...))`）。
