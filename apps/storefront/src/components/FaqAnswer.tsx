import Link from "next/link";
import { parseFaqAnswer, type FaqAnswerPart } from "@/lib/faq";

const PART_COLOR = { red: "var(--brand-deep)", blue: "var(--brand-blue)" } as const;

const LINK_STYLE = {
  color: "var(--brand-deep)",
  fontWeight: 600,
  textDecoration: "underline",
  textUnderlineOffset: 3,
} as const;

function Parts({ parts }: { parts: FaqAnswerPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.href ? (
          p.href.startsWith("http") ? (
            <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
              {p.text}
            </a>
          ) : p.href.startsWith("#") ? (
            // plain <a>: native hash navigation fires hashchange, which FaqHashOpener needs
            <a key={i} href={p.href} style={LINK_STYLE}>
              {p.text}
            </a>
          ) : (
            <Link key={i} href={p.href} style={LINK_STYLE}>
              {p.text}
            </Link>
          )
        ) : p.color ? (
          <span key={i} style={{ color: PART_COLOR[p.color], fontWeight: 600 }}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Renders a FAQ answer string (steps + highlight/link tokens) as paragraphs and numbered lists. */
export function FaqAnswer({ a }: { a: string }) {
  return (
    <>
      {parseFaqAnswer(a).map((b, i) =>
        b.type === "steps" ? (
          <ol
            key={i}
            className="muted"
            style={{ margin: "10px 0 0", paddingLeft: 24, lineHeight: 1.75 }}
          >
            {b.items.map((parts, j) => (
              <li key={j} style={{ marginBottom: 2 }}>
                <Parts parts={parts} />
              </li>
            ))}
          </ol>
        ) : (
          <p key={i} className="muted" style={{ margin: "10px 0 0", lineHeight: 1.75 }}>
            <Parts parts={b.parts} />
          </p>
        ),
      )}
    </>
  );
}
