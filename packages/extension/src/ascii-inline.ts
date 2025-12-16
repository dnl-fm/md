/**
 * ASCII diagram renderer with embedded WASM.
 * 
 * This module embeds the WASM binary as base64 to avoid CSP issues
 * with fetching external resources on sandboxed pages.
 */

// WASM binary embedded as base64 - generated from ascii_bg.wasm
const WASM_BASE64 = "WASM_PLACEHOLDER";

let wasm: any;
let initialized = false;

// Text encoder/decoder
const cachedTextEncoder = new TextEncoder();
let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

let cachedUint8ArrayMemory0: Uint8Array | null = null;
let WASM_VECTOR_LEN = 0;

function getUint8ArrayMemory0(): Uint8Array {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr: number, len: number): string {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function passStringToWasm0(arg: string, malloc: Function, realloc: Function): number {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7F) break;
    mem[ptr + offset] = code;
  }
  
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written!;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

function takeFromExternrefTable0(idx: number): any {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}

/**
 * Initialize the WASM module (must be called before render_ascii)
 */
export async function initAsciiWasm(): Promise<boolean> {
  if (initialized) return true;
  
  try {
    // Decode base64 to binary
    const binaryString = atob(WASM_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Compile and instantiate
    const imports = {
      wbg: {
        __wbindgen_init_externref_table: function() {
          const table = wasm.__wbindgen_externrefs;
          const offset = table.grow(4);
          table.set(0, undefined);
          table.set(offset + 0, undefined);
          table.set(offset + 1, null);
          table.set(offset + 2, true);
          table.set(offset + 3, false);
        },
        __wbindgen_cast_2241b6af4c4b2941: function(arg0: number, arg1: number) {
          return getStringFromWasm0(arg0, arg1);
        },
      }
    };
    
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, imports);
    wasm = instance.exports;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    
    initialized = true;
    return true;
  } catch (error) {
    console.warn("MD: Failed to initialize ASCII WASM", error);
    return false;
  }
}

/**
 * Render ASCII diagram from Mermaid-like syntax
 */
export function render_ascii(input: string): string {
  if (!initialized || !wasm) {
    throw new Error("ASCII WASM not initialized. Call initAsciiWasm() first.");
  }
  
  let deferred3_0: number;
  let deferred3_1: number;
  
  try {
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.render_ascii(ptr0, len0);
    var ptr2 = ret[0];
    var len2 = ret[1];
    if (ret[3]) {
      ptr2 = 0;
      len2 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred3_0 = ptr2;
    deferred3_1 = len2;
    return getStringFromWasm0(ptr2, len2);
  } finally {
    wasm.__wbindgen_free(deferred3_0!, deferred3_1!, 1);
  }
}
