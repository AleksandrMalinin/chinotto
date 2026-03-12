import { ChinottoLogo } from "@/components/ChinottoLogo";

const INTRO_LOGO_SIZE = 128;

const LOGO_PAUSE_MS = 500;
const LOGO_MOVE_MS = 1100;
const LOGO_TRANSITION_TOTAL_MS = LOGO_PAUSE_MS + LOGO_MOVE_MS;

export { LOGO_TRANSITION_TOTAL_MS };

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
  transitioning: boolean;
  targetRect: Rect | null;
  onTransitionEnd: () => void;
};

export function LogoTransition({ transitioning, targetRect, onTransitionEnd }: Props) {
  const hasTarget = transitioning && targetRect != null;

  return (
    <div
      className="logo-transition"
      style={{
        position: "fixed",
        zIndex: 101,
        left: hasTarget ? targetRect.left : "50%",
        top: hasTarget ? targetRect.top : "38%",
        width: hasTarget ? targetRect.width : INTRO_LOGO_SIZE,
        height: hasTarget ? targetRect.height : INTRO_LOGO_SIZE,
        transform: hasTarget ? "none" : "translate(-50%, -50%)",
        transition: hasTarget
          ? `left ${LOGO_MOVE_MS}ms ease-out ${LOGO_PAUSE_MS}ms, top ${LOGO_MOVE_MS}ms ease-out ${LOGO_PAUSE_MS}ms, width ${LOGO_MOVE_MS}ms ease-out ${LOGO_PAUSE_MS}ms, height ${LOGO_MOVE_MS}ms ease-out ${LOGO_PAUSE_MS}ms, transform ${LOGO_MOVE_MS}ms ease-out ${LOGO_PAUSE_MS}ms`
          : undefined,
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName === "left" && hasTarget) onTransitionEnd();
      }}
    >
      <ChinottoLogo size={INTRO_LOGO_SIZE} animated={!hasTarget} fillContainer />
    </div>
  );
}
