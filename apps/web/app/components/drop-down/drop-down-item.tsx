import { useCallback, useRef } from "react";
import { useIsomorphicLayoutEffect } from "~/hooks/use-isomorphic-layout-effect";
import type { UIComponentProps } from "~/utils/component";
import { useDropDownContext } from "./drop-down-context";

export function DropDownItem(props: UIComponentProps<"li">) {
  const { menuItemRef, focusedElement, setExpanded } = useDropDownContext();
  const _ref = useRef<HTMLLIElement | null>(null);
  const handleClickRef = useRef(props.onClick);
  const handleKeyDownRef = useRef(props.onKeyDown);
  useIsomorphicLayoutEffect(() => {
    handleClickRef.current = props.onClick;
    handleKeyDownRef.current = props.onKeyDown;
  });

  const handleClick = useCallback<React.MouseEventHandler<HTMLLIElement>>(
    (event) => {
      handleClickRef.current?.(event);
      if (event.defaultPrevented) {
        return;
      }

      setExpanded(false);
    },
    [setExpanded],
  );

  const handleKeyDown = useCallback<React.KeyboardEventHandler<HTMLLIElement>>(
    (event) => {
      handleKeyDownRef.current?.(event);

      if (
        event.target instanceof Node &&
        !event.currentTarget.contains(event.target)
      ) {
        return;
      }

      switch (event.key) {
        case "Enter":
        case " ": {
          const maybeButton = event.currentTarget.querySelector("button");
          event.preventDefault();
          if (maybeButton) {
            maybeButton.click();
          }
          if (event.defaultPrevented) {
            return;
          }
          setExpanded(false);
          break;
        }
      }
    },
    [setExpanded],
  );

  const ref = useCallback<React.RefCallback<HTMLLIElement>>(
    (node) => {
      _ref.current = node;
      menuItemRef(node);
    },
    [menuItemRef],
  );

  useIsomorphicLayoutEffect(() => {
    if (_ref.current && _ref.current === focusedElement) {
      _ref.current.tabIndex = 0;
    } else if (_ref.current) {
      _ref.current.tabIndex = -1;
    }
  }, [focusedElement]);

  return (
    <li
      {...props}
      className="first-of-type:rounded-t-inherit last-of-type:rounded-b-inherit flex cursor-pointer flex-col justify-center p-2 whitespace-nowrap hover:bg-gray-50 focus:bg-gray-50"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={ref}
      role="menuitem"
    />
  );
}
