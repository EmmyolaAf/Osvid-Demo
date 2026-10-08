import esbuild from "esbuild";
import { rmSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const emulatorTestFile = path.resolve(process.cwd(), "tests/emulator/rules.test.ts");
const outDir = path.resolve(process.cwd(), "tests/.dist-emulator");

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("==> Bundling Firebase Rules Emulator test suite...");

esbuild.buildSync({
  entryPoints: [emulatorTestFile],
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  external: [
    "@firebase/rules-unit-testing",
    "firebase-admin",
    "firebase-admin/*",
    "firebase",
    "firebase/*",
    "node:*",
  ],
  alias: {
    "@": process.cwd(),
  },
});

console.log("==> Executing Firebase Rules Emulator tests with Node test runner...");
const bundledFile = path.join(outDir, "rules.test.mjs");

const res = spawnSync(process.execPath, ["--test", bundledFile], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
  },
});

process.exit(res.status ?? 0);
