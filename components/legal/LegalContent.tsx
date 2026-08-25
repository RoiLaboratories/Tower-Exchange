import type { LegalBlock, LegalSection } from "@/lib/legal/parseLegalMarkdown";

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.type === "blockquote" && block.content) {
    return (
      <blockquote
        className="rounded-xl border border-[#7BB8FF]/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: block.content }}
      />
    );
  }

  if (block.type === "list" && block.items) {
    return (
      <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
        {block.items.map((item, itemIndex) => (
          <li key={`${itemIndex}-${item.slice(0, 24)}`} className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "table" && block.headers && block.rows) {
    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary">
              {block.headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 font-medium text-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr
                key={row.join("-")}
                className="border-b border-border/70 last:border-b-0"
              >
                {row.map((cell) => (
                  <td
                    key={`${row[0]}-${cell}`}
                    className="px-4 py-3 font-light text-muted-foreground"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "heading" && block.content) {
    return (
      <h3 className="pt-1 text-base font-semibold text-foreground">
        {block.content}
      </h3>
    );
  }

  if (block.content) {
    return (
      <p
        className="text-sm leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: block.content }}
      />
    );
  }

  return null;
}

export function LegalSectionCard({ section }: { section: LegalSection }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-28 bg-card border border-border rounded-[25px] p-6 sm:p-8 shadow-xl"
    >
      <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
        {section.title}
      </h2>
      <div className="w-full h-px bg-border my-4 sm:my-5" />
      <div className="space-y-4">
        {section.blocks.map((block, index) => (
          <LegalBlockView key={`${section.id}-${index}`} block={block} />
        ))}
      </div>
    </section>
  );
}

export function LegalTableOfContents({ sections }: { sections: LegalSection[] }) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Table of contents"
      className="bg-card border border-border rounded-[25px] p-6 sm:p-8 shadow-xl"
    >
      <h2 className="text-lg font-bold text-foreground tracking-tight">
        Table of Contents
      </h2>
      <div className="w-full h-px bg-border my-4" />
      <ol className="space-y-2.5">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {index + 1}. {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
