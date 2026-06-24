import { useMemo } from "react";
import { parseTextWithUrls } from "@/lib/urlInText";
import { openUrl } from "@tauri-apps/plugin-opener";

function openLink(href: string): void {
  openUrl(href).catch(() => {
    window.open(href, "_blank", "noopener,noreferrer");
  });
}

type Props = {
  text: string;
  className?: string;
};

export function LinkifiedText({ text, className }: Props) {
  const segments = useMemo(() => parseTextWithUrls(text).segments, [text]);

  return (
    <span className={className}>
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
    </span>
  );
}
