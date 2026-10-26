// 打包网页：web/dist/ 里是可以直接部署的文件，
// web/dist/hachimi.html 是单文件版，双击就能玩
import * as esbuild from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const dir = new URL(".", import.meta.url).pathname;
const dist = dir + "dist/";
const serve = process.argv.includes("--serve");

await mkdir(dist, { recursive: true });

async function copyStatic() {
  await copyFile(dir + "index.html", dist + "index.html");
  await copyFile(dir + "style.css", dist + "style.css");
}

const options = {
  entryPoints: [dir + "src/main.ts"],
  bundle: true,
  format: "iife",
  target: ["es2020", "safari15"],
  outfile: dist + "app.js",
  minify: !serve,
  logLevel: "info",
};

if (serve) {
  await copyStatic();
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: dist, port: 8000 });
  console.log(`\n打开浏览器访问 http://localhost:${port}  （按 Ctrl+C 停止）\n`);
} else {
  await esbuild.build(options);
  await copyStatic();
  const html = await readFile(dir + "index.html", "utf8");
  const css = await readFile(dir + "style.css", "utf8");
  const js = await readFile(dist + "app.js", "utf8");
  const single = html
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}</style>`)
    .replace('<script src="app.js"></script>', () => `<script>\n${js.replace(/<\/script/gi, "<\\/script")}</script>`);
  await writeFile(dist + "hachimi.html", single);
  console.log("单文件版：web/dist/hachimi.html");
}
