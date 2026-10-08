import esbuild from "esbuild";
import { readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const testsDir = path.resolve(process.cwd(), "tests");
const outDir = path.resolve(testsDir, ".dist");

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

const testFiles = readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.mjs"))
  .map((f) => path.join(testsDir, f));

console.log(`==> Bundling ${testFiles.length} test suite(s)...`);

esbuild.buildSync({
  entryPoints: testFiles,
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  external: [
    "next/server.js",
    "firebase-admin",
    "firebase-admin/*",
    "firebase",
    "firebase/*",
    "node:*",
  ],
  alias: {
    "@": process.cwd(),
    "next/server": "next/server.js",
    "server-only": path.resolve(process.cwd(), "node_modules/server-only/empty.js"),
  },
});


console.log("==> Running test suite with Node test runner...");
const bundledFiles = readdirSync(outDir)
  .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))
  .map((f) => path.join(outDir, f));

const res = spawnSync(process.execPath, ["--test", ...bundledFiles], {
  stdio: "inherit",
});

process.exit(res.status || 0);
