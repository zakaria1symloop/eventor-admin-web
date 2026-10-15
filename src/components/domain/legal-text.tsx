import type { ReactNode } from "react";

/**
 * Renders the markdown-lite of the legal pages (Settings · Legal): `## ` headings,
 * `- ` bullets, blank lines between paragraphs, `**bold**`, and bare https links.
 * Builds React elements only — the admin's text is never injected as HTML.
 */
export function LegalText({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-3 text-14 leading-relaxed text-ink-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        if (lines.length === 1 && lines[0]!.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-3 text-16 font-semibold text-ink">
              {inline(lines[0]!.slice(3))}
            </h2>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 ps-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** `**bold**` and links inside one line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).flatMap((part, i): ReactNode[] => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return [
        <strong key={i} className="font-semibold text-ink">
          {links(part.slice(2, -2), i)}
        </strong>,
      ];
    }
    return links(part, i);
  });
}

function links(text: string, key: number): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, j) => {
    if (!/^https?:\/\//.test(part)) return <span key={`${key}-${j}`}>{part}</span>;
    const url = part.replace(/[.,;:]+$/, "");
    return (
      <span key={`${key}-${j}`}>
        <a href={url} className="break-all font-medium text-brand hover:underline" dir="ltr">
          {url}
        </a>
        {part.slice(url.length)}
      </span>
    );
  });
}
