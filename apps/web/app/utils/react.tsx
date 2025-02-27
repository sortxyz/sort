import { Children, forwardRef, isValidElement } from "react";

export function genericForwardRef<T, P = Record<PropertyKey, unknown>>(
  render: (
    props: React.PropsWithoutRef<P>,
    ref: React.Ref<T>,
  ) => React.ReactNode,
): (props: P & React.RefAttributes<T>) => React.ReactNode {
  return forwardRef(render) as unknown as (
    props: P & React.RefAttributes<T>,
  ) => React.ReactNode;
}

export function someChild(
  children: React.ReactNode,
  predicate: (
    child: React.ReactNode,
    index: number,
    array: React.ReactNode[],
  ) => boolean,
) {
  return Children.toArray(children).some(predicate);
}

export function someNestedChild(
  children: React.ReactNode,
  predicate: (
    child: React.ReactNode,
    index: number,
    array: React.ReactNode[],
  ) => boolean,
): boolean {
  return Children.toArray(children).some((child) => {
    return (
      someChild(child, predicate) ||
      (isValidElement(child) &&
        someNestedChild(
          (child.props as React.PropsWithChildren).children,
          predicate,
        ))
    );
  });
}
