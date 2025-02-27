import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";
import { useMediaQuery } from "./use-media-query";

export function useDialog({
  onClose,
  open,
  start = { transform: "translate(100%, 0)" },
  end = { transform: "translate(0, 0)" },
  duration = 150,
  easing = "ease-in-out",
}: {
  onClose?: () => void;
  open?: boolean;
  start?: Keyframe;
  end?: Keyframe;
  duration?: number;
  easing?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [animatedOpen, setAnimatedOpen] = useState(false);
  const onCloseRef = useRef(onClose);
  const shouldCloseRef = useRef(false);
  const startTransformRef = useRef(start);
  const endTransformRef = useRef(end);
  useIsomorphicLayoutEffect(() => {
    onCloseRef.current = onClose;
    startTransformRef.current = start;
    endTransformRef.current = end;
  });

  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );

  const handleClose = useCallback(() => {
    if (!prefersReducedMotion) {
      setAnimatedOpen(false);
    } else {
      // For non-animated closing
      const dialog = ref.current;
      if (dialog?.open) {
        dialog.close();
      }
      setIsVisible(false);
      onCloseRef.current?.();
    }
  }, [prefersReducedMotion]);

  const handlePointerDown = useCallback<
    React.PointerEventHandler<HTMLDialogElement>
  >((event) => {
    if (event.target === event.currentTarget) {
      shouldCloseRef.current = true;
    }
  }, []);

  const handlePointerUp = useCallback<
    React.PointerEventHandler<HTMLDialogElement>
  >(
    (event) => {
      if (event.target === event.currentTarget && shouldCloseRef.current) {
        handleClose();
        shouldCloseRef.current = false;
      }
    },
    [handleClose],
  );

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      if (prefersReducedMotion) {
        // No animation, open the dialog immediately
        const dialog = ref.current;
        if (dialog && !dialog.open) {
          requestAnimationFrame(() => {
            dialog.showModal();
          });
        }
      } else {
        // Start opening animation only if not already animated open
        setAnimatedOpen((prev) => (prev ? prev : !prev));
      }
    } else {
      if (prefersReducedMotion) {
        // No animation, close the dialog immediately
        const dialog = ref.current;
        if (dialog?.open) {
          dialog.close();
        }
        setIsVisible(false);
        onCloseRef.current?.();
      } else {
        // Start closing animation only if currently animated open
        setAnimatedOpen((prev) => (prev ? !prev : prev));
      }
    }
  }, [open]); // Removed `prefersReducedMotion` from dependencies

  useEffect(() => {
    if (isVisible) {
      // After rendering, call showModal()
      const dialog = ref.current;
      if (dialog && !dialog.open) {
        // Use requestAnimationFrame to ensure the dialog is in the DOM
        requestAnimationFrame(() => {
          flushSync(() => {
            dialog.showModal();
            if (!prefersReducedMotion) {
              setAnimatedOpen(true);
            }
          });
        });
      }
    }
  }, [isVisible, prefersReducedMotion]);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const dialog = ref.current;

    // Cancel any ongoing animations when prefersReducedMotion or other dependencies change
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }

    if (prefersReducedMotion) {
      // No animation, handle opening or closing immediately
      if (animatedOpen && !dialog.open) {
        // Should be open, but dialog is closed
        dialog.showModal();
      } else if (!animatedOpen && dialog.open) {
        // Should be closed, but dialog is open
        dialog.close();
        setIsVisible(false);
        onCloseRef.current?.();
      }
      return; // Exit early since no animation is needed
    }

    // Proceed with animation
    const keyframes = animatedOpen
      ? [startTransformRef.current, endTransformRef.current]
      : [endTransformRef.current, startTransformRef.current];

    let isCancelled = false;

    const animation = dialog.animate(keyframes, {
      duration,
      easing,
      fill: "both",
    });

    // Store the animation so we can cancel it later if needed
    animationRef.current = animation;

    animation.onfinish = () => {
      if (isCancelled) {
        return;
      }
      if (!animatedOpen) {
        // Close the dialog and remove it from the DOM
        dialog.close();
        setIsVisible(false);
        onCloseRef.current?.();
      }
      animationRef.current = null;
    };

    return () => {
      isCancelled = true;
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
      }
    };
  }, [animatedOpen]); // Removed `prefersReducedMotion` from dependencies

  return {
    handleClose,
    handlePointerDown,
    handlePointerUp,
    isVisible,
    ref,
  };
}
