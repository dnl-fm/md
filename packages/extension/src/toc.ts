export interface TOCEntry {
  level: number;
  text: string;
  id: string;
}

/**
 * Build table of contents from markdown content
 */
export function buildTOC(markdown: string): TOCEntry[] {
  const entries: TOCEntry[] = [];
  const lines = markdown.split("\n");
  const usedIds = new Set<string>();

  for (const line of lines) {
    // Match ATX-style headers (# Header)
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = generateId(text, usedIds);

      entries.push({ level, text, id });
    }
  }

  return entries;
}

/**
 * Generate a unique slug ID for a heading
 */
function generateId(text: string, usedIds: Set<string>): string {
  // Convert to lowercase, replace spaces with hyphens, remove special chars
  let id = text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure uniqueness
  const baseId = id;
  let counter = 1;
  while (usedIds.has(id)) {
    id = `${baseId}-${counter++}`;
  }
  usedIds.add(id);

  return id;
}

/**
 * Add IDs to headings in HTML content
 * (Called after markdown rendering to ensure links work)
 */
export function addHeadingIds(container: HTMLElement): void {
  const usedIds = new Set<string>();
  const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");

  for (const heading of headings) {
    const text = heading.textContent || "";
    const id = generateId(text, usedIds);
    heading.id = id;
  }
}
