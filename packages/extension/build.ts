import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from "fs";
import { join, dirname } from "path";

const DIST_DIR = "./dist";
const SHARED_STYLES = "../shared/styles";

// Ensure dist directory exists
if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}

// Build the content script
async function buildContentScript() {
  console.log("Building content script...");

  const result = await Bun.build({
    entrypoints: ["./src/content.ts"],
    outdir: DIST_DIR,
    minify: true,
    target: "browser",
    format: "iife",
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log("✓ content.js built");
}

// Build combined CSS
function buildStyles() {
  console.log("Building styles...");

  // Read shared styles
  const themeCSS = readFileSync(join(SHARED_STYLES, "theme.css"), "utf-8");
  const markdownCSS = readFileSync(join(SHARED_STYLES, "markdown.css"), "utf-8");

  // Read extension-specific styles
  const extensionCSS = readFileSync("./src/extension.css", "utf-8");

  // Combine all styles
  const combined = `
/* MD Extension Styles */
/* Auto-generated - do not edit */

/* === Theme Variables === */
${themeCSS}

/* === Markdown Rendering === */
${markdownCSS}

/* === Extension UI === */
${extensionCSS}
`.trim();

  writeFileSync(join(DIST_DIR, "styles.css"), combined);
  console.log("✓ styles.css built");
}

// Copy manifest
function copyManifest() {
  console.log("Copying manifest...");
  cpSync("./manifest.json", join(DIST_DIR, "manifest.json"));
  console.log("✓ manifest.json copied");
}

// Copy icons
function copyIcons() {
  console.log("Copying icons...");
  const iconsDir = join(DIST_DIR, "icons");
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
  }

  // For now, create placeholder icons (you can replace with real ones)
  const sizes = [16, 48, 128];
  for (const size of sizes) {
    const iconPath = `./icons/icon${size}.png`;
    const destPath = join(iconsDir, `icon${size}.png`);

    if (existsSync(iconPath)) {
      cpSync(iconPath, destPath);
    } else {
      // Create a simple SVG placeholder and note that real icons are needed
      console.log(`  ⚠ Missing icon: ${iconPath}`);
    }
  }
  console.log("✓ icons copied");
}

// Main build
async function build() {
  console.log("Building MD extension...\n");

  await buildContentScript();
  buildStyles();
  copyManifest();
  copyIcons();

  console.log("\n✓ Build complete! Extension at:", DIST_DIR);
  console.log("\nTo test:");
  console.log("1. Open chrome://extensions");
  console.log("2. Enable Developer mode");
  console.log("3. Load unpacked → select packages/extension/dist");
}

build().catch(console.error);
