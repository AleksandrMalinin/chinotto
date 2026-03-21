/** Semver from `package.json`, injected at build time in `vite.config.ts`. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "0.0.0-dev";
