// Simple dev server using Bun
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf("."));
  return MIME_TYPES[ext] || "application/octet-stream";
}

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    
    // Default to index.html
    if (path === "/") {
      path = "/index.html";
    }
    
    // Try to serve from public first, then root
    let file = Bun.file(`./public${path}`);
    if (!(await file.exists())) {
      file = Bun.file(`.${path}`);
    }
    
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": getMimeType(path),
        },
      });
    }
    
    // 404 fallback
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Dev server running at http://localhost:${server.port}`);
