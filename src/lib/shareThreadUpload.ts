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
};

export function shareThreadCreateMessage(input: ShareThreadCreateMessageInput): string {
  const { url, savedHtml, hosted } = input;
  if (hosted) {
    return savedHtml
      ? `Thread saved and link is live. Link copied to clipboard.\n\n${url}`
      : `Link is live and copied to clipboard.\n\n${url}`;
  }
  if (savedHtml) {
    return `Thread saved. Link copied to clipboard.\n\n${url}\n\nHosted sharing is unavailable — send the HTML file until the link works.`;
  }
  return `Thread created. Link copied to clipboard.\n\n${url}\n\nHosted sharing is unavailable — save the HTML preview or try again later.`;
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
