import { useEffect, useMemo, useRef } from "react";

class Machine {
  summary: HTMLElement;
  animation: Animation | null = null;
  state: "idle" | "closing" | "expanding" = "idle";
  static inEffect(details: HTMLDetailsElement, content: HTMLElement) {
    return new Machine(details, content).dispose;
  }
  constructor(
    public details: HTMLDetailsElement,
    public content: HTMLElement,
  ) {
    this.details = details;
    this.content = content;
    const summary = details.querySelector("summary");
    if (!summary) {
      throw new Error("No <summary> element found in the <details> element");
    }
    this.summary = summary;
    this.summary.addEventListener("click", this.onClick);
  }

  dispose = () => {
    this.summary.removeEventListener("click", this.onClick);
  };

  shrink() {
    this.state = "closing";

    const startHeight = `${this.details.offsetHeight}px`;
    const detailsComputedStyle = getComputedStyle(this.details);
    const endHeight = `${this.summary.offsetHeight + Number.parseFloat(detailsComputedStyle.paddingTop) + Number.parseFloat(detailsComputedStyle.paddingBottom)}px`;

    if (this.animation) {
      this.animation.cancel();
    }

    this.animation = this.details.animate(
      {
        height: [startHeight, endHeight],
      },
      {
        duration: 150,
        easing: "ease",
      },
    );

    this.animation.onfinish = () => this.onAnimationFinish(false);
    this.animation.oncancel = () => {
      this.state = "idle";
    };
  }

  open() {
    this.details.style.setProperty("height", `${this.details.offsetHeight}px`);
    this.details.setAttribute("open", "");
    window.requestAnimationFrame(this.expand);
  }

  onAnimationFinish(open: boolean) {
    if (open) {
      this.details.setAttribute("open", "");
    } else {
      this.details.removeAttribute("open");
    }
    this.animation = null;
    this.state = "idle";
    this.details.style.removeProperty("overflow");
    this.details.style.removeProperty("height");
  }

  expand = () => {
    this.state = "expanding";
    const startHeight = `${this.details.offsetHeight}px`;
    const endHeight = `${this.details.offsetHeight + this.content.offsetHeight}px`;

    if (this.animation) {
      this.animation.cancel();
    }

    this.animation = this.details.animate(
      {
        height: [startHeight, endHeight],
      },
      {
        duration: 300,
        easing: "ease",
      },
    );
    this.animation.onfinish = () => this.onAnimationFinish(true);
    this.animation.oncancel = () => (this.state = "idle");
  };
  onClick = (event: MouseEvent) => {
    event.preventDefault();
    this.details.style.setProperty("overflow", "hidden");
    if (this.state === "closing" || !this.details.open) {
      this.open();
    } else if (this.state === "expanding" || this.details.open) {
      this.shrink();
    }
  };
}

export function useAnimatedDetails<ContentElement extends HTMLElement>() {
  const ref = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<ContentElement>(null);

  useEffect(() => {
    if (!ref.current || !contentRef.current) {
      return;
    }

    return Machine.inEffect(ref.current, contentRef.current);
  }, []);

  return useMemo(() => ({ ref, contentRef }), []);
}
