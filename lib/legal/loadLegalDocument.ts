import { readFileSync } from "fs";
import path from "path";
import { parseLegalMarkdown } from "@/lib/legal/parseLegalMarkdown";

export function loadLegalDocument(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  const markdown = readFileSync(filePath, "utf8");
  return parseLegalMarkdown(markdown);
}
