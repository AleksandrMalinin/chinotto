import { useEffect, useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { StreamFlowPanel } from "@/components/StreamFlowPanel";

type Props = {
  onClose: () => void;
};

const emptyOnboardingEase = [0.22, 1, 0.36, 1] as const;

const emptyOnboardingItem = {
  hidden: { opacity: 0, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.62, ease: emptyOnboardingEase },
  },
};

const emptyOnboardingContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.18 },
  },
};

const emptyOnboardingInstant = {
  hidden: { opacity: 1, filter: "blur(0px)" },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0 },
  },
};

const emptyOnboardingContainerInstant = {
  hidden: {},
  visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

/**
 * Welcome-stream layout replay (panel + copy + motion) without replacing the main timeline.
 */
export function StreamShowcaseModal({ onClose }: Props) {
  const [isClosing, setIsClosing] = useState(false);
  const reduceMotion = useReducedMotion();

  const item = reduceMotion ? emptyOnboardingInstant : emptyOnboardingItem;
  const container = reduceMotion ? emptyOnboardingContainerInstant : emptyOnboardingContainer;

  const close = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [close]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest?.(".stream-showcase-sheet")) close();
  };

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === "chinotto-card-overlay-out") onClose();
  };

  return (
    <div
      className="stream-showcase-overlay"
      data-closing={isClosing || undefined}
      role="dialog"
      aria-label="Welcome screen preview"
      aria-modal="true"
      onClick={handleOverlayClick}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="stream-showcase-scroll">
        <article
          className="stream-showcase-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="stream-empty-kicker stream-showcase-kicker">Chinotto</p>
          <motion.div
            className="stream-showcase-body"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            <motion.div className="stream-showcase-visual" variants={item}>
              <StreamFlowPanel calm={!!reduceMotion} deferMotion={false} />
            </motion.div>
            <motion.div
              className="stream-empty-onboarding-copy stream-showcase-copy"
              variants={container}
            >
              <motion.h2 className="stream-empty-title" variants={item}>
                Just write. No structure.
              </motion.h2>
              <motion.p className="stream-empty-lead" variants={item}>
                Pick up where you left off.
              </motion.p>
              <motion.p className="stream-empty-meta" variants={item}>
                Your thoughts leave a trail.
                <br />
                You’ll see them again when it matters.
              </motion.p>
            </motion.div>
          </motion.div>
        </article>
      </div>
    </div>
  );
}
