// Build script - copies files to dist folder
import { cp, mkdir, readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";

const DIST = "./dist";

async function inlineHtml(filename: string, css: string): Promise<void> {
  const html = await readFile(filename, "utf-8");
  
  // Replace CSS link with inline style
  const inlinedHtml = html.replace(
    '<link rel="stylesheet" href="/styles.css">',
    `<style>${css}</style>`
  );
  
  await writeFile(join(DIST, filename), inlinedHtml);
  console.log(`  ✓ ${filename}`);
}

async function build() {
  console.log("Building www...");
  
  // Create dist directory
  await mkdir(DIST, { recursive: true });
  
  // Copy public assets
  await cp("./public", DIST, { recursive: true });
  
  // Read CSS once
  const css = await readFile("./public/styles.css", "utf-8");
  
  // Process all HTML files
  const files = await readdir(".");
  const htmlFiles = files.filter(f => f.endsWith(".html"));
  
  for (const file of htmlFiles) {
    await inlineHtml(file, css);
  }
  
  console.log(`✓ Built ${htmlFiles.length} pages to ./dist`);
}

build().catch(console.error);
