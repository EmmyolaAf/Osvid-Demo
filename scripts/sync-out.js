/**
 * Script to sync fresh Next.js production build outputs into out/ directory for Firebase Hosting
 */
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT_DIR, "out");
const NEXT_DIR = path.join(ROOT_DIR, ".next");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function syncHtmlFiles(serverAppDir, destDir) {
  if (!fs.existsSync(serverAppDir)) return;

  const entries = fs.readdirSync(serverAppDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(serverAppDir, entry.name);

    if (entry.isDirectory()) {
      const targetSubDir = path.join(destDir, entry.name);
      syncHtmlFiles(srcPath, targetSubDir);
    } else if (entry.name.endsWith(".html")) {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      if (entry.name === "_not-found.html" || entry.name === "_global-error.html") {
        fs.copyFileSync(srcPath, path.join(OUT_DIR, "404.html"));
      }

      // Copy page.html directly
      const destFilePath = path.join(destDir, entry.name);
      fs.copyFileSync(srcPath, destFilePath);

      // Also create folder/index.html for clean URL routing
      if (entry.name !== "index.html" && !entry.name.startsWith("_")) {
        const pageName = entry.name.replace(/\.html$/, "");
        const cleanFolder = path.join(destDir, pageName);
        if (!fs.existsSync(cleanFolder)) fs.mkdirSync(cleanFolder, { recursive: true });
        fs.copyFileSync(srcPath, path.join(cleanFolder, "index.html"));
      }
    }
  }
}

console.log("==> Syncing Next.js production build to out/ for Firebase Hosting...");

// 1. Clean / create out directory
if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

// 2. Copy static public assets
console.log("==> Copying public/ assets...");
copyDirRecursive(PUBLIC_DIR, OUT_DIR);

// 3. Copy .next/static -> out/_next/static
const nextStaticSrc = path.join(NEXT_DIR, "static");
const nextStaticDest = path.join(OUT_DIR, "_next", "static");
console.log("==> Copying Next.js client static bundles...");
copyDirRecursive(nextStaticSrc, nextStaticDest);

// 4. Copy HTML pages from .next/server/app -> out
const serverAppDir = path.join(NEXT_DIR, "server", "app");
console.log("==> Copying compiled HTML pages...");
syncHtmlFiles(serverAppDir, OUT_DIR);

// 5. Ensure 404 fallback exists
if (!fs.existsSync(path.join(OUT_DIR, "404.html")) && fs.existsSync(path.join(OUT_DIR, "index.html"))) {
  fs.copyFileSync(path.join(OUT_DIR, "index.html"), path.join(OUT_DIR, "404.html"));
}

console.log("✓ Successfully synchronized fresh build output into out/ directory!");
