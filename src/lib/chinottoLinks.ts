/** App Store listing URL (same app record as iOS; opens correctly for Mac from the App Store app). */
export const CHINOTTO_MAC_APP_STORE_URL =
  "https://apps.apple.com/us/app/chinotto/id6761345307";

/** Hosted thread read URL (Slice 2). Copied on share create; HTML file works in Slice 1. */
export const CHINOTTO_SHARE_BASE_URL = "https://share.chinotto.app/t";

/** Share API origin for publish/revoke (override in dev via VITE_CHINOTTO_SHARE_API_BASE). */
export const CHINOTTO_SHARE_API_BASE =
  import.meta.env.VITE_CHINOTTO_SHARE_API_BASE ?? "https://share.chinotto.app";

export function shareThreadUrl(token: string): string {
  return `${CHINOTTO_SHARE_BASE_URL}/${token}`;
}
