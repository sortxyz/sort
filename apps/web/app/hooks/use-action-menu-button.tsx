import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRefList } from "~/hooks/use-ref-list";
import { sortNodesByPosition } from "~/utils/node";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

export type UseActionMenuButtonProps = {
  defaultExpanded?: boolean;
  expanded?: boolean;
  setExpanded?: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useActionMenuButton<T extends HTMLElement>({
  defaultExpanded = false,
  expanded: controlledExpanded,
  setExpanded: controlledSetExpanded,
}: UseActionMenuButtonProps = {}) {
  const buttonId = useId();
  const menuId = useId();
  const [menuItemElements, menuItemRef] = useRefList<T>();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [focusedElement, setFocusedElement] = useState<T | null>(null);
  const [uncontrolledExpanded, setUncontrolledExpanded] =
    useState<boolean>(defaultExpanded);
  const expanded = controlledExpanded ?? uncontrolledExpanded;

  const setExpandedRef = useRef(controlledSetExpanded);
  useIsomorphicLayoutEffect(() => {
    setExpandedRef.current = controlledSetExpanded;
  });

  const setExpanded = useCallback<
    React.Dispatch<React.SetStateAction<boolean>>
  >(
    (expanded) => {
      const newExpanded =
        typeof expanded === "function"
          ? expanded(uncontrolledExpanded)
          : expanded;
      setUncontrolledExpanded(newExpanded);
      setExpandedRef.current?.(newExpanded);
    },
    [uncontrolledExpanded],
  );

  useEffect(() => {
    if (expanded && focusedElement) {
      focusedElement.focus();
    }
  }, [expanded, focusedElement]);

  const sortedMenuItemElements = useMemo(
    () => sortNodesByPosition(menuItemElements),
    [menuItemElements],
  );

  const handleWindowKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (buttonRef.current === document.activeElement) {
        switch (event.key) {
          case "ArrowDown":
          case " ":
          case "Enter":
            event.preventDefault();
            setExpanded(true);
            setFocusedElement(sortedMenuItemElements[0] ?? null);
            break;
        }
        return;
      }

      if (!expanded) {
        return;
      }

      if (/^[a-z]$/.test(event.key)) {
        event.preventDefault();
        const index = sortedMenuItemElements.findIndex((ref) =>
          ref.textContent?.toLowerCase().startsWith(event.key.toLowerCase()),
        );
        if (index !== -1) {
          setFocusedElement(sortedMenuItemElements[index] ?? null);
        }
        return;
      }

      const currentIndex = sortedMenuItemElements.indexOf(focusedElement!);
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setExpanded(false);
          buttonRef.current?.focus();
          break;
        case "ArrowDown":
          event.preventDefault();
          setFocusedElement(
            sortedMenuItemElements[
              (currentIndex + 1) % sortedMenuItemElements.length
            ] ?? null,
          );
          break;
        case "Home":
          event.preventDefault();
          setFocusedElement(sortedMenuItemElements[0] ?? null);
          break;
        case "End":
          event.preventDefault();
          setFocusedElement(
            sortedMenuItemElements[sortedMenuItemElements.length - 1] ?? null,
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedElement(
            sortedMenuItemElements[
              (currentIndex - 1 + sortedMenuItemElements.length) %
                sortedMenuItemElements.length
            ] ?? null,
          );
          break;
        case "Tab":
          event.preventDefault();
          setExpanded(false);
          break;
      }
    },
    [expanded, focusedElement, sortedMenuItemElements, setExpanded],
  );

  const handleWindowMouseDown = useCallback(
    (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!rootRef.current?.contains(event.target)) {
        setExpanded(false);
      } else if (buttonRef.current?.contains(event.target)) {
        setExpanded((prev) => !prev);
      }
    },
    [setExpanded],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("mousedown", handleWindowMouseDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("mousedown", handleWindowMouseDown);
    };
  }, [handleWindowKeyDown, handleWindowMouseDown]);

  return {
    buttonId,
    buttonRef,
    expanded,
    focusedElement,
    menuId,
    menuItemElements,
    menuItemRef,
    rootRef,
    setExpanded,
  };
}
