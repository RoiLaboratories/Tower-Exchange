export interface LegalBlock {
  type: "paragraph" | "blockquote" | "list" | "table" | "heading";
  content?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
}

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parseInline(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
      '<a class="text-primary underline underline-offset-2" href="mailto:$1">$1</a>',
    );
}

function parseTableRow(line: string) {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

export function parseLegalMarkdown(markdown: string): {
  lastUpdated: string | null;
  sections: LegalSection[];
} {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let lastUpdated: string | null = null;
  const sections: LegalSection[] = [];
  let currentSection: LegalSection | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith("# ") && !line.startsWith("## ")) {
      i += 1;
      continue;
    }

    if (line.startsWith("**Last Updated:")) {
      lastUpdated = line.replace(/\*\*/g, "").replace("Last Updated:", "").trim();
      i += 1;
      continue;
    }

    if (line.startsWith("## ") && !line.startsWith("### ")) {
      const title = line.replace(/^##\s+/, "").trim();
      currentSection = {
        id: slugify(title),
        title,
        blocks: [],
      };
      sections.push(currentSection);
      i += 1;
      continue;
    }

    if (line.startsWith("### ") && currentSection) {
      currentSection.blocks.push({
        type: "heading",
        content: line.replace(/^###\s+/, "").trim(),
      });
      i += 1;
      continue;
    }

    if (!currentSection) {
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      currentSection.blocks.push({
        type: "blockquote",
        content: parseInline(quoteLines.join(" ")),
      });
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(parseInline(lines[i].trim().replace(/^-\s+/, "")));
        i += 1;
      }
      currentSection.blocks.push({ type: "list", items });
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const headers = parseTableRow(tableLines[0] ?? "");
      const rows = tableLines
        .slice(2)
        .map(parseTableRow)
        .filter((row) => row.length > 0);
      currentSection.blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (line.startsWith("---")) {
      i += 1;
      continue;
    }

    if (line.startsWith("*Contact:")) {
      currentSection.blocks.push({
        type: "paragraph",
        content: parseInline(line.replace(/^\*|\*$/g, "")),
      });
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().startsWith("-") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("---") &&
      !lines[i].trim().startsWith("*Contact:")
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }

    const paragraphText = paragraphLines
      .join(" ")
      .replace(/^#{1,6}\s+/, "")
      .trim();

    if (paragraphText) {
      currentSection.blocks.push({
        type: "paragraph",
        content: parseInline(paragraphText),
      });
    }
  }

  return { lastUpdated, sections };
}
