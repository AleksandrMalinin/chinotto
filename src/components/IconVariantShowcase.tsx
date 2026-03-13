import { ChinottoLogo } from "@/components/ChinottoLogo";
import { getIconVariant, SELECTABLE_ICON_VARIANT_IDS } from "@/lib/iconVariants";

const PREVIEW_SIZE = 64;
const selectableVariants = SELECTABLE_ICON_VARIANT_IDS.map((id) => getIconVariant(id));

export function IconVariantShowcase() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center py-16 px-6"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div className="flex flex-col items-center gap-10 max-w-2xl w-full">
        <header className="flex flex-col items-center gap-3 text-center">
          <ChinottoLogo size={80} className="text-[#8a94c8]" />
          <h1 className="text-2xl font-light tracking-tight text-[var(--fg)]">
            Icon variants
          </h1>
          <p className="text-sm text-[var(--fg-dim)] max-w-md">
            Logo style variants for the app icon switcher. One size, color and surface only.
          </p>
        </header>

        <section
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full"
          aria-label="Icon variant previews"
        >
          {selectableVariants.map((v) => (
            <div
              key={v.id}
              className="flex flex-col items-center gap-3"
            >
              <div
                className="rounded-xl flex items-center justify-center p-4 w-[88px] h-[88px]"
                style={{
                  background: v.background,
                  border: v.border,
                  boxShadow: v.boxShadow,
                }}
              >
                <div style={{ color: v.foreground }}>
                  <ChinottoLogo size={PREVIEW_SIZE} />
                </div>
              </div>
              <span className="text-xs text-[var(--muted)]">{v.name}</span>
            </div>
          ))}
        </section>

        <p className="text-xs text-[var(--muted)] border-t border-[var(--border)] pt-6">
          View this screen in dev: <code className="text-[var(--fg-dim)]">#icon-variants</code>
        </p>
      </div>
    </div>
  );
}
