import { build, context } from "esbuild";
import { cpSync, globSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(root, "dist");
const watch = process.argv.includes("--watch");

// Every src/<part>/main.ts is an extension entry point (background, popup, ...).
// New parts are picked up by convention; do not list entry points manually.
const entryPoints = globSync("src/*/main.ts", { cwd: root }).map((entry) =>
  path.join(root, entry),
);

const options = {
  entryPoints,
  outdir: distDir,
  outbase: path.join(root, "src"),
  bundle: true,
  format: "esm",
  target: "firefox127",
  sourcemap: true,
  logLevel: "info",
};

function copyAssets() {
  cpSync(path.join(root, "manifest.json"), path.join(distDir, "manifest.json"));
  cpSync(path.join(root, "icons"), path.join(distDir, "icons"), {
    recursive: true,
  });
  for (const asset of globSync("src/**/*.{html,css}", { cwd: root })) {
    cpSync(
      path.join(root, asset),
      path.join(distDir, path.relative("src", asset)),
    );
  }
}

rmSync(distDir, { recursive: true, force: true });
copyAssets();

if (watch) {
  // Assets are copied once at startup; re-run the build after HTML/CSS changes.
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
