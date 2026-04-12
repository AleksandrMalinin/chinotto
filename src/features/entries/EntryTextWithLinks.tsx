import { useMemo } from "react";
import { parseTextWithUrls } from "@/lib/urlInText";
import { isThoughtDetailEditEnabled } from "@/lib/thoughtDetailEdit";
import { openUrl } from "@tauri-apps/plugin-opener";

type Props = {
  text: string;
  /** "stream" = wrap in p.entry-row-text (parent adds entry-row-text-wrap); "detail" = wrap in div.entry-detail-text */
  variant: "stream" | "detail";
};

function openLink(href: string): void {
  openUrl(href).catch(() => {
    window.open(href, "_blank", "noopener,noreferrer");
  });
}

export function EntryTextWithLinks({ text, variant }: Props) {
  const { segments, singleHostname } = useMemo(() => parseTextWithUrls(text), [text]);

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

  if (variant === "detail") {
    return (
      <div className="entry-detail-text">
        <span className="entry-detail-text-inner">{content}</span>
        {singleHostname && <span className="entry-domain-badge">{singleHostname}</span>}
      </div>
    );
  }

  if (!isThoughtDetailEditEnabled()) {
    return (
      <>
        <p className="entry-row-text">{content}</p>
        {singleHostname && <span className="entry-domain-badge">{singleHostname}</span>}
      </>
    );
  }

  return <p className="entry-row-text">{content}</p>;
}
