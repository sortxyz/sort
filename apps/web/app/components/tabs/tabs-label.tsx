import type { UIComponentProps } from "~/utils/component";
import { useTabsContext } from "./tabs-context";

export function TabsLabel(props: Omit<UIComponentProps<"h3">, "id">) {
  const {
    tabsListLabelledByState: [tabsListLabelledBy],
  } = useTabsContext();

  // eslint-disable-next-line jsx-a11y/heading-has-content
  return <h3 {...props} id={tabsListLabelledBy} />;
}
