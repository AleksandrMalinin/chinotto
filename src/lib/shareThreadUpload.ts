import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { CHINOTTO_SHARE_API_BASE } from "./chinottoLinks";

export type ShareThreadPublishPayload = {
  token: string;
  html: string;
  expiresAt: string;
  contextNote?: string;
};

export type ShareThreadCreateMessageInput = {
  url: string;
  savedHtml: boolean;
  hosted: boolean;
  copied: boolean;
};

export function shareThreadCreateMessage(input: ShareThreadCreateMessageInput): string {
  const { url, savedHtml, hosted, copied } = input;
  const copiedLine = copied
    ? "Link copied to clipboard."
    : "Copy the link below.";
  if (hosted) {
    return savedHtml
      ? `${copiedLine} A local HTML copy was saved.\n\n${url}`
      : `${copiedLine}\n\n${url}`;
  }
  if (savedHtml) {
    return copied
      ? `Link copied. Send the saved HTML file — hosting was unavailable.\n\n${url}`
      : `Hosting was unavailable. Send the saved HTML file and copy the link below.\n\n${url}`;
  }
  return `${copiedLine}\n\n${url}`;
}

export async function publishShareThreadSnapshot(
  payload: ShareThreadPublishPayload
): Promise<boolean> {
  try {
    const res = await tauriFetch(`${CHINOTTO_SHARE_API_BASE}/api/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: payload.token,
        html: payload.html,
        expiresAt: payload.expiresAt,
        contextNote: payload.contextNote ?? null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function revokeShareThreadRemote(token: string): Promise<boolean> {
  try {
    const res = await tauriFetch(
      `${CHINOTTO_SHARE_API_BASE}/api/threads/${encodeURIComponent(token)}`,
      { method: "DELETE" }
    );
    return res.ok;
  } catch {
    return false;
  }
}
