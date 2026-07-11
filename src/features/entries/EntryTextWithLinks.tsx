import { useMemo } from "react";
import { parseTextWithUrls } from "@/lib/urlInText";
import {
  classifyPreviewLine,
  parseReadablePlainText,
  type ReadableBlock,
  type ReadableLine,
} from "@/lib/readablePlainText";
import { formatContinuationDate } from "@/lib/formatContinuationDate";
import { streamPreviewFirstLine } from "@/lib/streamPreviewFirstLine";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LinkifiedText } from "./LinkifiedText";

function openLink(href: string): void {
  openUrl(href).catch(() => {
    window.open(href, "_blank", "noopener,noreferrer");
  });
}

type Props = {
  text: string;
  /** "stream" = wrap in p.entry-row-text (parent adds entry-row-text-wrap); "detail" = wrap in div.entry-detail-text */
  variant: "stream" | "detail";
  continuationFrom?: number;
  continuationAt?: string;
};

function lineClassName(line: ReadableLine): string | undefined {
  return line.isQuestion ? "entry-readable-question" : undefined;
}

function ReadableLineContent({ line }: { line: ReadableLine }) {
  return <LinkifiedText text={line.text} className={lineClassName(line)} />;
}

function ReadableBlocks({ blocks }: { blocks: ReadableBlock[] }) {
  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (block.type === "list") {
          return (
            <ul key={blockIndex} className="entry-readable-list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <ReadableLineContent line={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote key={blockIndex} className="entry-readable-blockquote">
              {block.lines.map((line, lineIndex) => (
                <p key={lineIndex} className="entry-readable-blockquote-line">
                  <ReadableLineContent line={line} />
                </p>
              ))}
            </blockquote>
          );
        }

        return (
          <p key={blockIndex} className="entry-readable-paragraph">
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <ReadableLineContent line={line} />
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function ReadableDetailBody({
  text,
  continuationFrom,
  continuationAt,
}: {
  text: string;
  continuationFrom?: number;
  continuationAt?: string;
}) {
  const hasContinuation =
    continuationFrom != null &&
    continuationFrom > 0 &&
    continuationFrom <= text.length;

  const primaryText = hasContinuation ? text.slice(0, continuationFrom) : text;
  const continuationText = hasContinuation
    ? text.slice(continuationFrom).replace(/^\n/, "")
    : "";

  const primaryBlocks = useMemo(
    () => parseReadablePlainText(primaryText),
    [primaryText]
  );
  const continuationBlocks = useMemo(
    () => parseReadablePlainText(continuationText),
    [continuationText]
  );

  if (!hasContinuation || !continuationText.trim()) {
    return (
      <div className="entry-readable">
        <ReadableBlocks blocks={primaryBlocks} />
      </div>
    );
  }

  return (
    <div className="entry-readable">
      <ReadableBlocks blocks={primaryBlocks} />
      <section className="entry-readable-continuation" aria-label="Continued later">
        {continuationAt ? (
          <p className="entry-readable-continuation-label">
            Continued on {formatContinuationDate(continuationAt)}
          </p>
        ) : null}
        <ReadableBlocks blocks={continuationBlocks} />
      </section>
    </div>
  );
}

function ReadableStreamPreview({ text }: { text: string }) {
  const line = useMemo(
    () => classifyPreviewLine(streamPreviewFirstLine(text)),
    [text]
  );

  if (line.kind === "bullet") {
    return (
      <span className="entry-readable-stream-bullet">
        <span className="entry-readable-stream-bullet-mark" aria-hidden>
          •
        </span>{" "}
        <LinkifiedText text={line.text} className={lineClassName(line)} />
      </span>
    );
  }

  if (line.kind === "blockquote") {
    return (
      <span className="entry-readable-stream-blockquote">
        <LinkifiedText text={line.text} className={lineClassName(line)} />
      </span>
    );
  }

  return <LinkifiedText text={line.text} className={lineClassName(line)} />;
}

export function EntryTextWithLinks({
  text,
  variant,
  continuationFrom,
  continuationAt,
}: Props) {
  const { segments, singleHostname } = useMemo(
    () => parseTextWithUrls(text),
    [text]
  );

  if (variant === "detail") {
    return (
      <div className="entry-detail-text">
        <div className="entry-detail-text-inner">
          <ReadableDetailBody
            text={text}
            continuationFrom={continuationFrom}
            continuationAt={continuationAt}
          />
        </div>
        {singleHostname && (
          <span className="entry-domain-badge">{singleHostname}</span>
        )}
      </div>
    );
  }

  const streamUsesFormatting = useMemo(() => {
    const preview = streamPreviewFirstLine(text);
    const line = classifyPreviewLine(preview);
    return (
      line.kind !== "plain" ||
      line.isQuestion ||
      segments.some((s) => s.type === "url")
    );
  }, [text, segments]);

  if (streamUsesFormatting) {
    return (
      <p className="entry-row-text">
        <ReadableStreamPreview text={text} />
      </p>
    );
  }

  const content = (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="entry-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openLink(seg.href);
            }}
          >
            <span className="entry-link-text">{seg.value}</span>
          </a>
        )
      )}
    </>
  );

  return <p className="entry-row-text">{content}</p>;
}
