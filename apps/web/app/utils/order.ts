export function getOrderDirectionIconName(order?: string) {
  switch (order) {
    case "ASC":
      return "chevron-up";
    case "DESC":
      return "chevron-down";
  }
}
