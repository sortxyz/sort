import { useEffect, useRef } from "react";
import type { UIComponentProps } from "~/utils/component";
import { FormValidationErrorInner } from "./form-error-inner";

export function FormError({
  errors,
  ...props
}: UIComponentProps<"ul"> & { errors?: string[] | undefined }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (listRef.current && errors?.length) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [errors]);

  if (!errors?.length) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2" ref={listRef} {...props}>
      {errors.map((error, index) => (
        <FormValidationErrorInner key={index} error={error} />
      ))}
    </ul>
  );
}
