import { Link, useRouteLoaderData } from "react-router";
import {
  IconAlertCircle,
  IconArrowsLeftRight,
  IconCheck,
  IconInfoCircle,
  IconQuestionMark,
  IconX,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useId } from "react";
import type { loader as rootLoader } from "~/root";
import type { UIComponentProps } from "~/utils/component";
import type { SessionFlashData } from "~/utils/flash";

const typeTitleMapping = {
  error: "Error",
  success: "Success",
  info: "Info",
} satisfies Record<SessionFlashData["flash"]["type"], string>;

const typeCategoryMapping = {
  error: "negativeWillHappen",
  success: "positiveWillHappen",
  info: "generalNotice",
} satisfies Record<
  SessionFlashData["flash"]["type"],
  React.ComponentPropsWithoutRef<typeof FlashMessage>["category"]
>;

export function useGlobalFlashMessage() {
  const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
  if (!rootLoaderData?.flash) {
    return null;
  }

  return {
    category: typeCategoryMapping[rootLoaderData.flash.type],
    title: typeTitleMapping[rootLoaderData.flash.type],
    description: rootLoaderData.flash.message,
    closeButton: (
      <Link to={{}} reloadDocument tabIndex={0}>
        <IconX className="stroke-1.5 size-5 stroke-inherit" />
      </Link>
    ),
  } satisfies React.ComponentPropsWithoutRef<typeof FlashMessage>;
}

const flashMessageIconMapping = {
  alternativeInfo: <IconArrowsLeftRight className="stroke-1.5 size-6" />,
  generalNotice: <IconInfoCircle className="stroke-1.5 size-6" />,
  highPriorityAlert: <IconAlertCircle className="stroke-1.5 size-6" />,
  lowPriorityAlert: <IconInfoCircle className="stroke-1.5 size-6" />,
  negativeCouldHappen: <IconQuestionMark className="stroke-1.5 size-6" />,
  negativeWillHappen: <IconAlertCircle className="stroke-1.5 size-6" />,
  neutralCouldHappen: <IconQuestionMark className="stroke-1.5 size-6" />,
  neutralWillHappen: <IconCheck className="stroke-1.5 size-6" />,
  positiveCouldHappen: <IconQuestionMark className="stroke-1.5 size-6" />,
  positiveWillHappen: <IconCheck className="stroke-1.5 size-6" />,
} satisfies Record<
  Exclude<
    React.ComponentPropsWithoutRef<typeof FlashMessage>["category"],
    undefined
  >,
  React.ReactNode
>;

export function FlashMessage({
  buttonGroup,
  category,
  closeButton,
  description,
  title,
  ...props
}: UIComponentProps<"div"> & {
  buttonGroup?: React.ReactNode;
  category:
    | "negativeWillHappen"
    | "negativeCouldHappen"
    | "positiveWillHappen"
    | "positiveCouldHappen"
    | "neutralWillHappen"
    | "neutralCouldHappen"
    | "generalNotice"
    | "alternativeInfo"
    | "highPriorityAlert"
    | "lowPriorityAlert";
  closeButton?: React.ReactNode;
  description?: React.ReactNode;
  title?: string;
}) {
  const iconLeft = flashMessageIconMapping[category];
  const titleId = useId();
  const descriptionId = useId();
  return (
    <div
      {...props}
      role="alert"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      className={clsx("flex flex-col gap-1.5 px-8 py-1.5 backdrop-blur-md", {
        "bg-orange-50/70 stroke-orange-800 text-orange-600":
          category === "highPriorityAlert",
        "bg-yellow-100/70 stroke-yellow-900 text-yellow-700":
          category === "neutralWillHappen" || category === "neutralCouldHappen",
        "bg-purple-50/70 stroke-purple-800 text-purple-600":
          category === "alternativeInfo",
        "bg-blue-50/70 stroke-blue-800 text-blue-600":
          category === "generalNotice" || category === "lowPriorityAlert",
        "bg-green-50/70 stroke-green-800 text-green-600":
          category === "positiveWillHappen" ||
          category === "positiveCouldHappen",
        "border-b border-red-50 bg-red-50/50 stroke-red-800 text-red-600":
          category === "negativeWillHappen" ||
          category === "negativeCouldHappen",
      })}
    >
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center">
        <div className="flex grow items-center gap-3 md:gap-6">
          <div className="inline-flex shrink-0 rounded-full bg-white p-1">
            {iconLeft}
          </div>
          <div className="grow">
            {title ? (
              <div id={titleId} className="text-base font-semibold md:text-lg">
                {title}
              </div>
            ) : undefined}
            {description ? (
              <p
                className="text-sm whitespace-pre-wrap md:text-base"
                id={descriptionId}
              >
                {description}
              </p>
            ) : undefined}
          </div>
          {closeButton ? (
            <div className="inline-flex shrink-0 p-1">{closeButton}</div>
          ) : undefined}
        </div>
        {buttonGroup}
      </div>
    </div>
  );
}
