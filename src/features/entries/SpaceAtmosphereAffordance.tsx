type Props = {
  open: boolean;
  onToggle: (el: HTMLButtonElement) => void;
  tabIndex?: number;
};

export function SpaceAtmosphereAffordance({ open, onToggle, tabIndex = 0 }: Props) {
  return (
    <button
      type="button"
      className={
        open
          ? "space-atmosphere-affordance space-atmosphere-affordance--open"
          : "space-atmosphere-affordance"
      }
      aria-label="Ambience"
      aria-expanded={open}
      aria-haspopup="dialog"
      title="Ambience"
      tabIndex={tabIndex}
      onClick={(e) => onToggle(e.currentTarget)}
    >
      <svg
        className="space-atmosphere-affordance__icon"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        <circle cx="7" cy="7" r="2.25" fill="currentColor" opacity="0.85" />
        <path
          d="M7 1.5a5.5 5.5 0 0 1 0 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </button>
  );
}
