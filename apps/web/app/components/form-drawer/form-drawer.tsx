import clsx from "clsx";
import { createPortal } from "react-dom";
import { useDialog } from "~/hooks/use-dialog";
import { useMergeRef } from "~/hooks/use-merge-ref";
import type { UIComponentProps } from "~/utils/component";
import { genericForwardRef } from "~/utils/react";

export const FormDrawer = genericForwardRef<
  React.ElementRef<"dialog">,
  Omit<UIComponentProps<"dialog">, "onClose"> & {
    onClose?: () => void;
  }
>(function FormDrawer({ children, open, onClose, ...props }, forwardedRef) {
  const { isVisible, ref, handlePointerUp, handlePointerDown, handleClose } =
    useDialog({
      onClose,
      open,
    });

  const mergeRef = useMergeRef(forwardedRef, ref);

  if (typeof document === "undefined" || !isVisible) {
    return null;
  }

  return createPortal(
    <dialog
      {...props}
      ref={mergeRef}
      onPointerUp={handlePointerUp}
      onPointerDown={handlePointerDown}
      onClose={handleClose}
      className={clsx(
        "backdrop:bg-transparent backdrop:backdrop-blur-xs",
        "inset-y-0 right-0 my-0 mr-0 ml-auto h-dvh max-h-dvh w-full max-w-xs flex-col overflow-y-auto border-l border-gray-300 bg-white p-0 transition-transform open:flex sm:max-w-md",
      )}
    >
      {children}
    </dialog>,
    document.body,
  );
});
