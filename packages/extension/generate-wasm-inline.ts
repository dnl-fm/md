#!/usr/bin/env bun
/**
 * Generate ascii-inline.generated.ts with embedded WASM binary
 */
import { readFileSync, writeFileSync } from "fs";

const WASM_FILE = "src/ascii-pkg/ascii_bg.wasm";
const TEMPLATE_FILE = "src/ascii-inline.ts";
const OUTPUT_FILE = "src/ascii-inline.generated.ts";

// Read WASM and convert to base64
const wasmBinary = readFileSync(WASM_FILE);
const wasmBase64 = wasmBinary.toString("base64");

// Read template and replace placeholder
const template = readFileSync(TEMPLATE_FILE, "utf-8");
const output = template.replace("WASM_PLACEHOLDER", wasmBase64);

// Write output
writeFileSync(OUTPUT_FILE, output);

console.log(`Generated ${OUTPUT_FILE} (${output.length} bytes)`);
console.log(`WASM size: ${wasmBinary.length} bytes -> ${wasmBase64.length} base64 chars`);
