export type UIComponentProps<T extends React.ElementType> = Omit<
  React.ComponentPropsWithoutRef<T>,
  "className"
>;
