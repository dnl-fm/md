#!/bin/bash
# Generate ascii-inline.generated.ts with embedded WASM binary

WASM_FILE="src/ascii-pkg/ascii_bg.wasm"
TEMPLATE_FILE="src/ascii-inline.ts"
OUTPUT_FILE="src/ascii-inline.generated.ts"

if [ ! -f "$WASM_FILE" ]; then
    echo "Error: $WASM_FILE not found"
    exit 1
fi

# Convert WASM to base64
WASM_BASE64=$(base64 -w 0 "$WASM_FILE")

# Replace placeholder with actual base64
sed "s|WASM_PLACEHOLDER|$WASM_BASE64|" "$TEMPLATE_FILE" > "$OUTPUT_FILE"

echo "Generated $OUTPUT_FILE ($(wc -c < "$OUTPUT_FILE") bytes)"
