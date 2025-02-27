import type { V2 } from "@sort/sdk";
import type { UIComponentProps } from "~/utils/component";
import { DiffView } from "./diff-view";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadRow,
  TableHeader,
  TableRow,
} from "./table";

function merge(
  change:
    | { action: "ADD"; fields: V2.ChangeField[] }
    | {
        action: "MODIFY";
        previous_fields: V2.ChangeField[];
        fields: V2.ChangeField[];
      }
    | {
        action: "DELETE";
        primary_keys: V2.ChangeField[];
        previous_fields: V2.ChangeField[];
      },
) {
  if (change.action !== "MODIFY") {
    return [];
  }
  return change.previous_fields.map((prevField) => {
    const changedField = change.fields.find((changedField) => {
      return changedField.column_name === prevField.column_name;
    });

    return [prevField, changedField] as const;
  });
}

export function ChangeTable({
  change,
  ...props
}: UIComponentProps<typeof Table> & {
  change:
    | {
        action: "ADD";
        fields: V2.ChangeField[];
      }
    | {
        action: "MODIFY";
        fields: V2.ChangeField[];
        previous_fields: V2.ChangeField[];
      }
    | {
        action: "DELETE";
        previous_fields: V2.ChangeField[];
        primary_keys: V2.ChangeField[];
      };
}) {
  const mergedChanges = merge(change);

  switch (change.action) {
    case "ADD":
      if (!change.fields.length) {
        return undefined;
      }

      return (
        <Table {...props}>
          <TableHead>
            <TableHeadRow>
              {change.fields.map((field) => (
                <TableHeader key={field.column_name}>
                  {field.column_name}
                </TableHeader>
              ))}
            </TableHeadRow>
          </TableHead>
          <TableBody>
            <TableRow>
              {change.fields.map((field) => (
                <TableCell key={field.column_name}>
                  <DiffView oldValue="" newValue={field.value} />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      );
    case "MODIFY":
      if (!change.fields.length) {
        return undefined;
      }

      return (
        <Table {...props}>
          <TableHead>
            <TableHeadRow>
              {change.previous_fields.map((field) => (
                <TableHeader key={field.column_name}>
                  {field.column_name}
                </TableHeader>
              ))}
            </TableHeadRow>
          </TableHead>
          <TableBody>
            <TableRow>
              {mergedChanges.map(([oldField, newField]) => (
                <TableCell key={oldField.column_name}>
                  <DiffView
                    oldValue={oldField.value}
                    newValue={
                      newField === undefined ? oldField.value : newField.value
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      );
    case "DELETE":
      if (!change.previous_fields.length) {
        return undefined;
      }

      return (
        <Table {...props}>
          <TableHead>
            <TableHeadRow>
              {change.previous_fields.map((field) => (
                <TableHeader key={field.column_name}>
                  {field.column_name}
                </TableHeader>
              ))}
            </TableHeadRow>
          </TableHead>
          <TableBody>
            <TableRow>
              {change.previous_fields.map((field) => (
                <TableCell key={field.column_name}>
                  <DiffView oldValue={field.value} newValue="" />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      );
    default:
      return undefined;
  }
}
