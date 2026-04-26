/**
 * Shown at the site root on Firebase Hosting (and optional `VITE_OAUTH_BRIDGE_ORIGIN` host)
 * so visitors do not mistake the OAuth-only deploy for a web app. `/chinotto-oauth` stays full SPA.
 */
export function HostingDesktopOnly() {
  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        boxSizing: "border-box",
        background: "#0a0a0e",
        color: "#e4e4e9",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        lineHeight: 1.55,
        fontSize: "15px",
      }}
    >
      <p style={{ margin: "0 0 1rem", maxWidth: "24rem" }}>
        Chinotto is a Mac app; your entries stay in the local database on your Mac. This site is
        only used for a short sign-in step from the app, not a full web version.
      </p>
      <a href="https://getchinotto.app" style={{ color: "#7dd3fc", textDecoration: "underline" }}>
        getchinotto.app
      </a>
    </div>
  );
}
