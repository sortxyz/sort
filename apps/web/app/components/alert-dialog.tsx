import {
  createContext,
  isValidElement,
  useContext,
  useId,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useDialog } from "~/hooks/use-dialog";
import { useMergeRef } from "~/hooks/use-merge-ref";
import type { UIComponentProps } from "~/utils/component";
import { genericForwardRef, someNestedChild } from "~/utils/react";

type AlertDialogContextValue = {
  id: string;
  handleClose: () => void;
};
const AlertDialogContext = createContext<undefined | AlertDialogContextValue>(
  undefined,
);

function useAlertDialogContext() {
  const context = useContext(AlertDialogContext);
  if (context === undefined) {
    throw new Error("useAlertDialogContext must be used within a AlertDialog");
  }
  return context;
}

export const AlertDialogCloseButton = genericForwardRef<
  React.ElementRef<"button">,
  UIComponentProps<"button">
>(function AlertDialogSheetCloseButton({ ...props }, ref) {
  const { handleClose } = useAlertDialogContext();
  return (
    <button
      {...props}
      ref={ref}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }
        handleClose();
      }}
      className="absolute top-0 right-0 rounded-xl p-4"
    />
  );
});

export function AlertDialogTitle(props: UIComponentProps<"div">) {
  const { id } = useAlertDialogContext();
  return (
    <div
      {...props}
      id={["alertdialog", id, "title"].join("-")}
      className="text-lg font-bold"
    />
  );
}

export function AlertDialogDescription(props: UIComponentProps<"div">) {
  const { id } = useAlertDialogContext();
  return (
    <div
      {...props}
      id={["alertdialog", id, "description"].join("-")}
      className="my-2"
    />
  );
}

export const AlertDialog = genericForwardRef<
  React.ElementRef<"dialog">,
  Omit<UIComponentProps<"dialog">, "onClose"> & { onClose?: () => void }
>(function AlertDialog({ open, onClose, ...props }, forwardedRef) {
  const { ref, handleClose, handlePointerDown, handlePointerUp, isVisible } =
    useDialog({
      open,
      onClose,
      start: { opacity: 0 },
      end: { opacity: 1 },
      duration: 300,
    });
  const mergeRef = useMergeRef(ref, forwardedRef);
  const id = useId();
  const alertDialog = useMemo(() => ({ id, handleClose }), [id, handleClose]);

  const hasTitle = useMemo(
    () =>
      someNestedChild(
        props.children,
        (child) => isValidElement(child) && child.type === AlertDialogTitle,
      ),
    [props.children],
  );
  const hasDescription = useMemo(
    () =>
      someNestedChild(
        props.children,
        (child) =>
          isValidElement(child) && child.type === AlertDialogDescription,
      ),
    [props.children],
  );

  if (typeof document === "undefined" || !isVisible) {
    return null;
  }

  return createPortal(
    <AlertDialogContext.Provider value={alertDialog}>
      <dialog
        {...props}
        ref={mergeRef}
        onPointerUp={handlePointerUp}
        onPointerDown={handlePointerDown}
        onClose={handleClose}
        id={["alertdialog", id].join("-")}
        role="alertdialog"
        aria-labelledby={
          hasTitle ? ["alertdialog", id, "title"].join("-") : undefined
        }
        aria-describedby={
          hasDescription
            ? ["alertdialog", id, "description"].join("-")
            : undefined
        }
        className="m-auto max-w-md rounded-xl bg-white p-6 text-gray-900 shadow-md shadow-black/5 backdrop:backdrop-blur-xs"
      />
    </AlertDialogContext.Provider>,
    document.body,
  );
});
