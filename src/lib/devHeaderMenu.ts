/** Dev-only header "Dev" dropdown; hide via VITE_HIDE_DEV_HEADER=true in .env.local */
export function isDevHeaderMenuVisible(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.VITE_HIDE_DEV_HEADER !== "true";
}
