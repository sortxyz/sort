/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { parseWithZod } from "@conform-to/zod";
import { describe, expect, it } from "vitest";
import { changeSchema } from "./change";

describe("changeSchema", () => {
  describe("for ADD", () => {
    describe("when fields are missing", () => {
      it("fails to parse", () => {
        const formData = new FormData();
        formData.set("action", "ADD");
        formData.set("schema_name", "public");
        formData.set("table_name", "users");

        const submission = parseWithZod(formData, { schema: changeSchema });

        expect(submission).toEqual({
          error: {
            fields: ["Array must contain at least 1 element(s)"],
          },
          payload: {
            action: "ADD",
            schema_name: "public",
            table_name: "users",
          },
          reply: expect.any(Function),
          status: "error",
        });
      });
    });
  });
  describe("for MODIFY", () => {
    describe("null fields and primary_keys", () => {
      it("parses", () => {
        const formData = new FormData();
        formData.set("action", "MODIFY");
        formData.set("schema_name", "public");
        formData.set("table_name", "users");

        formData.set("fields[0].column_name", "string-null-empty");
        formData.set("fields[0].type", "string");
        formData.set("fields[0].value_type", "null");
        formData.set("fields[0].value", "");

        formData.set("fields[1].column_name", "numeric-null-empty");
        formData.set("fields[1].type", "numeric");
        formData.set("fields[1].value_type", "null");
        formData.set("fields[1].value", "");

        formData.set("fields[2].column_name", "boolean-null-empty");
        formData.set("fields[2].type", "boolean");
        formData.set("fields[2].value_type", "null");
        formData.set("fields[2].value", "");

        formData.set("fields[3].column_name", "date-null-empty");
        formData.set("fields[3].type", "date");
        formData.set("fields[3].value_type", "null");
        formData.set("fields[3].value", "");

        formData.set("fields[4].column_name", "json-null-empty");
        formData.set("fields[4].type", "json");
        formData.set("fields[4].value_type", "null");
        formData.set("fields[4].value", "");

        formData.set("primary_keys[0].column_name", "uuid-null-empty");
        formData.set("primary_keys[0].type", "uuid");
        formData.set("primary_keys[0].value_type", "null");
        formData.set("primary_keys[0].value", "");

        const submission = parseWithZod(formData, { schema: changeSchema });

        expect(submission).toEqual({
          payload: {
            action: "MODIFY",
            fields: [
              {
                column_name: "string-null-empty",
                value_type: "null",
                type: "string",
                value: "",
              },
              {
                column_name: "numeric-null-empty",
                value_type: "null",
                type: "numeric",
                value: "",
              },
              {
                column_name: "boolean-null-empty",
                value_type: "null",
                type: "boolean",
                value: "",
              },
              {
                column_name: "date-null-empty",
                value_type: "null",
                type: "date",
                value: "",
              },
              {
                column_name: "json-null-empty",
                value_type: "null",
                type: "json",
                value: "",
              },
            ],
            primary_keys: [
              {
                column_name: "uuid-null-empty",
                value_type: "null",
                type: "uuid",
                value: "",
              },
            ],
            schema_name: "public",
            table_name: "users",
          },
          reply: expect.any(Function),
          status: "success",
          value: {
            action: "MODIFY",
            fields: [
              {
                column_name: "string-null-empty",
                value: null,
              },
              {
                column_name: "numeric-null-empty",
                value: null,
              },
              {
                column_name: "boolean-null-empty",
                value: null,
              },
              {
                column_name: "date-null-empty",
                value: null,
              },
              {
                column_name: "json-null-empty",
                value: null,
              },
            ],
            primary_keys: [
              {
                column_name: "uuid-null-empty",
                value: null,
              },
            ],
            schema_name: "public",
            table_name: "users",
          },
        });
      });
    });
    describe("undefined fields and primary_keys", () => {
      it("parses", () => {
        const formData = new FormData();
        formData.set("action", "MODIFY");
        formData.set("schema_name", "public");
        formData.set("table_name", "users");

        formData.set("fields[0].column_name", "string-undefined-empty");
        formData.set("fields[0].value_type", "undefined");
        formData.set("fields[0].value", "");
        formData.set("fields[0].type", "string");

        formData.set("fields[1].column_name", "numeric-undefined-empty");
        formData.set("fields[1].value_type", "undefined");
        formData.set("fields[1].value", "");
        formData.set("fields[1].type", "numeric");

        formData.set("fields[2].column_name", "boolean-undefined-empty");
        formData.set("fields[2].value_type", "undefined");
        formData.set("fields[2].value", "");
        formData.set("fields[2].type", "boolean");

        formData.set("fields[3].column_name", "date-undefined-empty");
        formData.set("fields[3].value_type", "undefined");
        formData.set("fields[3].value", "");
        formData.set("fields[3].type", "date");

        formData.set("fields[4].column_name", "json-undefined-empty");
        formData.set("fields[4].value_type", "undefined");
        formData.set("fields[4].value", "");
        formData.set("fields[4].type", "json");

        formData.set("fields[5].column_name", "string-string-value");
        formData.set("fields[5].value_type", "string");
        formData.set("fields[5].value", "yep");
        formData.set("fields[5].type", "string");

        formData.set("primary_keys[0].column_name", "uuid-undefined-empty");
        formData.set("primary_keys[0].value_type", "undefined");
        formData.set("primary_keys[0].value", "");
        formData.set("primary_keys[0].type", "uuid");

        formData.set("primary_keys[1].column_name", "string-string-value");
        formData.set("primary_keys[1].value_type", "string");
        formData.set("primary_keys[1].value", "yep");
        formData.set("primary_keys[1].type", "string");

        const submission = parseWithZod(formData, { schema: changeSchema });

        expect(submission).toEqual({
          payload: {
            action: "MODIFY",
            fields: [
              {
                column_name: "string-undefined-empty",
                value_type: "undefined",
                type: "string",
                value: "",
              },
              {
                column_name: "numeric-undefined-empty",
                value_type: "undefined",
                type: "numeric",
                value: "",
              },
              {
                column_name: "boolean-undefined-empty",
                value_type: "undefined",
                type: "boolean",
                value: "",
              },
              {
                column_name: "date-undefined-empty",
                value_type: "undefined",
                type: "date",
                value: "",
              },
              {
                column_name: "json-undefined-empty",
                value_type: "undefined",
                type: "json",
                value: "",
              },
              {
                column_name: "string-string-value",
                value_type: "string",
                type: "string",
                value: "yep",
              },
            ],
            primary_keys: [
              {
                column_name: "uuid-undefined-empty",
                value_type: "undefined",
                type: "uuid",
                value: "",
              },
              {
                column_name: "string-string-value",
                value_type: "string",
                type: "string",
                value: "yep",
              },
            ],
            schema_name: "public",
            table_name: "users",
          },
          reply: expect.any(Function),
          status: "success",
          value: {
            action: "MODIFY",
            fields: [
              {
                column_name: "string-string-value",
                value: "yep",
              },
            ],
            primary_keys: [
              {
                column_name: "string-string-value",
                value: "yep",
              },
            ],
            schema_name: "public",
            table_name: "users",
          },
        });
      });
      describe("all fields undefined", () => {
        it("fails to parse", () => {
          const formData = new FormData();
          formData.set("action", "MODIFY");
          formData.set("schema_name", "public");
          formData.set("table_name", "users");

          formData.set("fields[0].column_name", "string-undefined-empty");
          formData.set("fields[0].value_type", "undefined");
          formData.set("fields[0].value", "");
          formData.set("fields[0].type", "string");

          formData.set("fields[1].column_name", "numeric-undefined-empty");
          formData.set("fields[1].value_type", "undefined");
          formData.set("fields[1].value", "");
          formData.set("fields[1].type", "numeric");

          formData.set("fields[2].column_name", "boolean-undefined-empty");
          formData.set("fields[2].value_type", "undefined");
          formData.set("fields[2].value", "");
          formData.set("fields[2].type", "boolean");

          formData.set("fields[3].column_name", "date-undefined-empty");
          formData.set("fields[3].value_type", "undefined");
          formData.set("fields[3].value", "");
          formData.set("fields[3].type", "date");

          formData.set("fields[4].column_name", "json-undefined-empty");
          formData.set("fields[4].value_type", "undefined");
          formData.set("fields[4].value", "");
          formData.set("fields[4].type", "json");

          formData.set("fields[5].column_name", "uuid-undefined-empty");
          formData.set("fields[5].value_type", "undefined");
          formData.set("fields[5].value", "");
          formData.set("fields[5].type", "uuid");

          formData.set("primary_keys[0].column_name", "string-string-value");
          formData.set("primary_keys[0].value_type", "string");
          formData.set("primary_keys[0].value", "yep");
          formData.set("primary_keys[0].type", "string");

          const submission = parseWithZod(formData, { schema: changeSchema });

          expect(submission).toEqual({
            error: {
              fields: ["Array must contain at least 1 element(s)"],
            },
            payload: {
              action: "MODIFY",
              fields: [
                {
                  column_name: "string-undefined-empty",
                  value_type: "undefined",
                  type: "string",
                  value: "",
                },
                {
                  column_name: "numeric-undefined-empty",
                  value_type: "undefined",
                  type: "numeric",
                  value: "",
                },
                {
                  column_name: "boolean-undefined-empty",
                  value_type: "undefined",
                  type: "boolean",
                  value: "",
                },
                {
                  column_name: "date-undefined-empty",
                  value_type: "undefined",
                  type: "date",
                  value: "",
                },
                {
                  column_name: "json-undefined-empty",
                  value_type: "undefined",
                  type: "json",
                  value: "",
                },
                {
                  column_name: "uuid-undefined-empty",
                  value_type: "undefined",
                  type: "uuid",
                  value: "",
                },
              ],
              primary_keys: [
                {
                  column_name: "string-string-value",
                  value_type: "string",
                  type: "string",
                  value: "yep",
                },
              ],
              schema_name: "public",
              table_name: "users",
            },
            reply: expect.any(Function),
            status: "error",
          });
        });
      });

      describe("all primary_keys undefined", () => {
        it("fails to parse", () => {
          const formData = new FormData();
          formData.set("action", "MODIFY");
          formData.set("schema_name", "public");
          formData.set("table_name", "users");

          formData.set("primary_keys[0].column_name", "string-undefined-empty");
          formData.set("primary_keys[0].value_type", "undefined");
          formData.set("primary_keys[0].value", "");
          formData.set("primary_keys[0].type", "string");

          formData.set(
            "primary_keys[1].column_name",
            "numeric-undefined-empty",
          );
          formData.set("primary_keys[1].value_type", "undefined");
          formData.set("primary_keys[1].value", "");
          formData.set("primary_keys[1].type", "numeric");

          formData.set(
            "primary_keys[2].column_name",
            "boolean-undefined-empty",
          );
          formData.set("primary_keys[2].value_type", "undefined");
          formData.set("primary_keys[2].value", "");
          formData.set("primary_keys[2].type", "boolean");

          formData.set("primary_keys[3].column_name", "date-undefined-empty");
          formData.set("primary_keys[3].value_type", "undefined");
          formData.set("primary_keys[3].value", "");
          formData.set("primary_keys[3].type", "date");

          formData.set("primary_keys[4].column_name", "json-undefined-empty");
          formData.set("primary_keys[4].value_type", "undefined");
          formData.set("primary_keys[4].value", "");
          formData.set("primary_keys[4].type", "json");

          formData.set("primary_keys[5].column_name", "uuid-undefined-empty");
          formData.set("primary_keys[5].value_type", "undefined");
          formData.set("primary_keys[5].value", "");
          formData.set("primary_keys[5].type", "uuid");

          formData.set("fields[0].column_name", "string-string-value");
          formData.set("fields[0].value_type", "string");
          formData.set("fields[0].value", "yep");
          formData.set("fields[0].type", "string");

          const submission = parseWithZod(formData, { schema: changeSchema });

          expect(submission).toEqual({
            error: {
              primary_keys: ["Array must contain at least 1 element(s)"],
            },
            payload: {
              action: "MODIFY",
              fields: [
                {
                  column_name: "string-string-value",
                  value_type: "string",
                  type: "string",
                  value: "yep",
                },
              ],
              primary_keys: [
                {
                  column_name: "string-undefined-empty",
                  value_type: "undefined",
                  type: "string",
                  value: "",
                },
                {
                  column_name: "numeric-undefined-empty",
                  value_type: "undefined",
                  type: "numeric",
                  value: "",
                },
                {
                  column_name: "boolean-undefined-empty",
                  value_type: "undefined",
                  type: "boolean",
                  value: "",
                },
                {
                  column_name: "date-undefined-empty",
                  value_type: "undefined",
                  type: "date",
                  value: "",
                },
                {
                  column_name: "json-undefined-empty",
                  value_type: "undefined",
                  type: "json",
                  value: "",
                },
                {
                  column_name: "uuid-undefined-empty",
                  value_type: "undefined",
                  type: "uuid",
                  value: "",
                },
              ],
              schema_name: "public",
              table_name: "users",
            },
            reply: expect.any(Function),
            status: "error",
          });
        });
      });
    });

    describe("included fields and primary_keys", () => {
      describe("when valid", () => {
        it("parses", () => {
          const formData = new FormData();
          formData.set("action", "MODIFY");
          formData.set("schema_name", "public");
          formData.set("table_name", "users");

          formData.set("fields[0].column_name", "string-string-empty");
          formData.set("fields[0].value_type", "string");
          formData.set("fields[0].value", "");
          formData.set("fields[0].type", "string");

          formData.set("fields[1].column_name", "string-string-value");
          formData.set("fields[1].value_type", "string");
          formData.set("fields[1].value", "firestarter");
          formData.set("fields[1].type", "string");

          formData.set("fields[2].column_name", "numeric-numeric-value");
          formData.set("fields[2].value_type", "numeric");
          formData.set("fields[2].value", "12345678.901234567");
          formData.set("fields[2].type", "numeric");

          formData.set("fields[3].column_name", "boolean-boolean-on");
          formData.set("fields[3].value_type", "boolean");
          formData.set("fields[3].value", "on");
          formData.set("fields[3].type", "boolean");

          formData.set("fields[4].column_name", "boolean-boolean-empty");
          formData.set("fields[4].value_type", "boolean");
          formData.set("fields[4].value", "");
          formData.set("fields[4].type", "boolean");

          formData.set("fields[5].column_name", "uuid-uuid-value");
          formData.set("fields[5].value_type", "uuid");
          formData.set(
            "fields[5].value",
            "cfc74431-3465-467f-bb2d-dfe6fd685379",
          );
          formData.set("fields[5].type", "uuid");

          formData.set("fields[6].column_name", "json-json-value");
          formData.set("fields[6].value_type", "json");
          formData.set("fields[6].value", '{ "key": "value" }');
          formData.set("fields[6].type", "json");

          formData.set("fields[7].column_name", "date-date-full");
          formData.set("fields[7].value_type", "date");
          formData.set("fields[7].value", "2024-06-26T19:00:58.591");
          formData.set("fields[7].type", "date");

          formData.set("fields[8].column_name", "date-date-android-chrome");
          formData.set("fields[8].value_type", "date");
          formData.set("fields[8].value", "2024-06-26T19:00");
          formData.set("fields[8].type", "date");

          formData.set("primary_keys[0].column_name", "string-string-empty");
          formData.set("primary_keys[0].value_type", "string");
          formData.set("primary_keys[0].value", "");
          formData.set("primary_keys[0].type", "string");

          formData.set("primary_keys[1].column_name", "string-string-value");
          formData.set("primary_keys[1].value_type", "string");
          formData.set("primary_keys[1].value", "firestarter");
          formData.set("primary_keys[1].type", "string");

          formData.set("primary_keys[2].column_name", "numeric-numeric-value");
          formData.set("primary_keys[2].value_type", "numeric");
          formData.set("primary_keys[2].value", "12345678.901234567");
          formData.set("primary_keys[2].type", "numeric");

          formData.set("primary_keys[3].column_name", "boolean-boolean-on");
          formData.set("primary_keys[3].value_type", "boolean");
          formData.set("primary_keys[3].value", "on");
          formData.set("primary_keys[3].type", "boolean");

          formData.set("primary_keys[4].column_name", "boolean-boolean-empty");
          formData.set("primary_keys[4].value_type", "boolean");
          formData.set("primary_keys[4].value", "");
          formData.set("primary_keys[4].type", "boolean");

          formData.set("primary_keys[5].column_name", "uuid-uuid-value");
          formData.set("primary_keys[5].value_type", "uuid");
          formData.set(
            "primary_keys[5].value",
            "cfc74431-3465-467f-bb2d-dfe6fd685379",
          );
          formData.set("primary_keys[5].type", "uuid");

          formData.set("primary_keys[6].column_name", "binary-binary-value");
          formData.set("primary_keys[6].value_type", "binary");
          formData.set("primary_keys[6].value", "aGVsbG8gd29ybGQ=");
          formData.set("primary_keys[6].type", "binary");

          formData.set("primary_keys[7].column_name", "json-json-value");
          formData.set("primary_keys[7].value_type", "json");
          formData.set("primary_keys[7].value", '{ "key": "value" }');
          formData.set("primary_keys[7].type", "json");

          formData.set("primary_keys[8].column_name", "date-date-full");
          formData.set("primary_keys[8].value_type", "date");
          formData.set("primary_keys[8].value", "2024-06-26T19:00:58.591");
          formData.set("primary_keys[8].type", "date");

          formData.set(
            "primary_keys[9].column_name",
            "date-date-android-chrome",
          );
          formData.set("primary_keys[9].value_type", "date");
          formData.set("primary_keys[9].value", "2024-06-26T19:00");
          formData.set("primary_keys[9].type", "date");

          const submission = parseWithZod(formData, { schema: changeSchema });

          expect(submission).toEqual({
            payload: {
              action: "MODIFY",
              fields: [
                {
                  column_name: "string-string-empty",
                  value_type: "string",
                  type: "string",
                  value: "",
                },
                {
                  column_name: "string-string-value",
                  value_type: "string",
                  type: "string",
                  value: "firestarter",
                },
                {
                  column_name: "numeric-numeric-value",
                  value_type: "numeric",
                  type: "numeric",
                  value: "12345678.901234567",
                },
                {
                  column_name: "boolean-boolean-on",
                  value_type: "boolean",
                  type: "boolean",
                  value: "on",
                },
                {
                  column_name: "boolean-boolean-empty",
                  value_type: "boolean",
                  type: "boolean",
                  value: "",
                },
                {
                  column_name: "uuid-uuid-value",
                  value_type: "uuid",
                  type: "uuid",
                  value: "cfc74431-3465-467f-bb2d-dfe6fd685379",
                },
                {
                  column_name: "json-json-value",
                  value_type: "json",
                  type: "json",
                  value: '{ "key": "value" }',
                },
                {
                  column_name: "date-date-full",
                  value_type: "date",
                  type: "date",
                  value: "2024-06-26T19:00:58.591",
                },
                {
                  column_name: "date-date-android-chrome",
                  value_type: "date",
                  type: "date",
                  value: "2024-06-26T19:00",
                },
              ],
              primary_keys: [
                {
                  column_name: "string-string-empty",
                  value_type: "string",
                  type: "string",
                  value: "",
                },
                {
                  column_name: "string-string-value",
                  value_type: "string",
                  type: "string",
                  value: "firestarter",
                },
                {
                  column_name: "numeric-numeric-value",
                  value_type: "numeric",
                  type: "numeric",
                  value: "12345678.901234567",
                },
                {
                  column_name: "boolean-boolean-on",
                  value_type: "boolean",
                  type: "boolean",
                  value: "on",
                },
                {
                  column_name: "boolean-boolean-empty",
                  value_type: "boolean",
                  type: "boolean",
                  value: "",
                },
                {
                  column_name: "uuid-uuid-value",
                  value_type: "uuid",
                  type: "uuid",
                  value: "cfc74431-3465-467f-bb2d-dfe6fd685379",
                },
                {
                  column_name: "binary-binary-value",
                  value_type: "binary",
                  type: "binary",
                  value: "aGVsbG8gd29ybGQ=",
                },
                {
                  column_name: "json-json-value",
                  value_type: "json",
                  type: "json",
                  value: '{ "key": "value" }',
                },
                {
                  column_name: "date-date-full",
                  value_type: "date",
                  type: "date",
                  value: "2024-06-26T19:00:58.591",
                },
                {
                  column_name: "date-date-android-chrome",
                  value_type: "date",
                  type: "date",
                  value: "2024-06-26T19:00",
                },
              ],
              schema_name: "public",
              table_name: "users",
            },
            reply: expect.any(Function),
            status: "success",
            value: {
              action: "MODIFY",
              fields: [
                {
                  column_name: "string-string-empty",
                  value: "",
                },
                {
                  column_name: "string-string-value",
                  value: "firestarter",
                },
                {
                  column_name: "numeric-numeric-value",
                  value: 12345678.901234567,
                },
                {
                  column_name: "boolean-boolean-on",
                  value: true,
                },
                {
                  column_name: "boolean-boolean-empty",
                  value: false,
                },
                {
                  column_name: "uuid-uuid-value",
                  value: "cfc74431-3465-467f-bb2d-dfe6fd685379",
                },
                {
                  column_name: "json-json-value",
                  value: '{ "key": "value" }',
                },
                {
                  column_name: "date-date-full",
                  value: "2024-06-26T19:00:58.591Z",
                },
                {
                  column_name: "date-date-android-chrome",
                  value: "2024-06-26T19:00:00.000Z",
                },
              ],
              primary_keys: [
                {
                  column_name: "string-string-empty",
                  value: "",
                },
                {
                  column_name: "string-string-value",
                  value: "firestarter",
                },
                {
                  column_name: "numeric-numeric-value",
                  value: 12345678.901234567,
                },
                {
                  column_name: "boolean-boolean-on",
                  value: true,
                },
                {
                  column_name: "boolean-boolean-empty",
                  value: false,
                },
                {
                  column_name: "uuid-uuid-value",
                  value: "cfc74431-3465-467f-bb2d-dfe6fd685379",
                },
                {
                  column_name: "binary-binary-value",
                  value: "aGVsbG8gd29ybGQ=",
                },
                {
                  column_name: "json-json-value",
                  value: '{ "key": "value" }',
                },
                {
                  column_name: "date-date-full",
                  value: "2024-06-26T19:00:58.591Z",
                },
                {
                  column_name: "date-date-android-chrome",
                  value: "2024-06-26T19:00:00.000Z",
                },
              ],
              schema_name: "public",
              table_name: "users",
            },
          });
        });
      });

      describe("when invalid fields", () => {
        it("fails to parse", () => {
          const formData = new FormData();
          formData.set("action", "MODIFY");
          formData.set("schema_name", "public");
          formData.set("table_name", "users");

          formData.set("fields[0].column_name", "string-string-number");
          formData.set("fields[0].value_type", "string");
          formData.set("fields[0].value", "3");
          formData.set("fields[0].type", "string");

          formData.set("fields[1].column_name", "numeric-numeric-string");
          formData.set("fields[1].value_type", "numeric");
          formData.set("fields[1].value", "1234567890.0123456789");
          formData.set("fields[1].type", "numeric");

          formData.set("fields[2].column_name", "uuid-uuid-value");
          formData.set("fields[2].value_type", "uuid");
          formData.set("fields[2].value", "non-uuid");
          formData.set("fields[2].type", "uuid");

          formData.set("fields[3].column_name", "json-json-value");
          formData.set("fields[3].value_type", "json");
          formData.set("fields[3].value", "{");
          formData.set("fields[3].type", "json");

          formData.set("fields[4].column_name", "date-date-full");
          formData.set("fields[4].value_type", "date");
          formData.set("fields[4].value", "not a date");
          formData.set("fields[4].type", "date");

          formData.set("primary_keys[0].column_name", "string-string-value");
          formData.set("primary_keys[0].value_type", "string");
          formData.set("primary_keys[0].value", "abc");
          formData.set("primary_keys[0].type", "string");

          const submission = parseWithZod(formData, { schema: changeSchema });

          expect(submission).toEqual({
            error: {
              "fields[2].value": ["Invalid uuid"],
              "fields[3].value": [
                "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
              ],
              "fields[4].value": ["Invalid datetime"],
            },
            payload: {
              action: "MODIFY",
              fields: [
                {
                  column_name: "string-string-number",
                  value_type: "string",
                  type: "string",
                  value: "3",
                },
                {
                  column_name: "numeric-numeric-string",
                  value_type: "numeric",
                  type: "numeric",
                  value: "1234567890.0123456789",
                },
                {
                  column_name: "uuid-uuid-value",
                  value_type: "uuid",
                  type: "uuid",
                  value: "non-uuid",
                },
                {
                  column_name: "json-json-value",
                  value_type: "json",
                  type: "json",
                  value: "{",
                },
                {
                  column_name: "date-date-full",
                  value_type: "date",
                  type: "date",
                  value: "not a date",
                },
              ],
              primary_keys: [
                {
                  column_name: "string-string-value",
                  value_type: "string",
                  type: "string",
                  value: "abc",
                },
              ],
              schema_name: "public",
              table_name: "users",
            },
            reply: expect.any(Function),
            status: "error",
          });
        });
      });

      describe("when invalid primary_keys", () => {
        it("fails to parse", () => {
          const formData = new FormData();
          formData.set("action", "MODIFY");
          formData.set("schema_name", "public");
          formData.set("table_name", "users");

          formData.set("primary_keys[0].column_name", "string-string-number");
          formData.set("primary_keys[0].value_type", "string");
          formData.set("primary_keys[0].value", "3"); // Using string representation of the number
          formData.set("primary_keys[0].type", "string");

          formData.set("primary_keys[1].column_name", "numeric-numeric-string");
          formData.set("primary_keys[1].value_type", "numeric");
          formData.set("primary_keys[1].value", "1234567890.0123456789");
          formData.set("primary_keys[1].type", "numeric");

          formData.set("primary_keys[2].column_name", "uuid-uuid-value");
          formData.set("primary_keys[2].value_type", "uuid");
          formData.set("primary_keys[2].value", "non-uuid");
          formData.set("primary_keys[2].type", "uuid");

          formData.set("primary_keys[3].column_name", "json-json-value");
          formData.set("primary_keys[3].value_type", "json");
          formData.set("primary_keys[3].value", "{");
          formData.set("primary_keys[3].type", "json");

          formData.set("primary_keys[4].column_name", "date-date-full");
          formData.set("primary_keys[4].value_type", "date");
          formData.set("primary_keys[4].value", "not a date");
          formData.set("primary_keys[4].type", "date");

          formData.set("primary_keys[5].column_name", "binary-binary-value");
          formData.set("primary_keys[5].value_type", "binary");
          formData.set("primary_keys[5].value", "not base64");
          formData.set("primary_keys[5].type", "binary");

          formData.set("fields[0].column_name", "string-string-empty");
          formData.set("fields[0].value_type", "string");
          formData.set("fields[0].value", "abc");
          formData.set("fields[0].type", "string");

          const submission = parseWithZod(formData, { schema: changeSchema });

          expect(submission).toEqual({
            error: {
              "primary_keys[2].value": ["Invalid uuid"],
              "primary_keys[3].value": [
                "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
              ],
              "primary_keys[4].value": ["Invalid datetime"],
              "primary_keys[5].value": ["Invalid base64"],
            },
            payload: {
              action: "MODIFY",
              fields: [
                {
                  column_name: "string-string-empty",
                  value_type: "string",
                  type: "string",
                  value: "abc",
                },
              ],
              primary_keys: [
                {
                  column_name: "string-string-number",
                  value_type: "string",
                  type: "string",
                  value: "3",
                },
                {
                  column_name: "numeric-numeric-string",
                  value_type: "numeric",
                  type: "numeric",
                  value: "1234567890.0123456789",
                },
                {
                  column_name: "uuid-uuid-value",
                  value_type: "uuid",
                  type: "uuid",
                  value: "non-uuid",
                },
                {
                  column_name: "json-json-value",
                  value_type: "json",
                  type: "json",
                  value: "{",
                },
                {
                  column_name: "date-date-full",
                  value_type: "date",
                  type: "date",
                  value: "not a date",
                },
                {
                  column_name: "binary-binary-value",
                  value_type: "binary",
                  type: "binary",
                  value: "not base64",
                },
              ],
              schema_name: "public",
              table_name: "users",
            },
            reply: expect.any(Function),
            status: "error",
          });
        });
      });

      describe("when fields are missing", () => {
        it("fails to parse", () => {
          const formData = new FormData();
          formData.set("action", "MODIFY");
          formData.set("schema_name", "public");
          formData.set("table_name", "users");

          formData.set("primary_keys[0].column_name", "string-string-value");
          formData.set("primary_keys[0].value_type", "string");
          formData.set("primary_keys[0].value", "abc");
          formData.set("primary_keys[0].type", "string");

          const submission = parseWithZod(formData, { schema: changeSchema });

          expect(submission).toEqual({
            error: {
              fields: ["Array must contain at least 1 element(s)"],
            },
            payload: {
              action: "MODIFY",
              primary_keys: [
                {
                  column_name: "string-string-value",
                  value_type: "string",
                  value: "abc",
                  type: "string",
                },
              ],
              schema_name: "public",
              table_name: "users",
            },
            reply: expect.any(Function),
            status: "error",
          });
        });
      });
    });
    describe("for DELETE", () => {
      describe("when fields are missing", () => {
        it("fails to parse", () => {
          const formData = new FormData();
          formData.set("action", "DELETE");
          formData.set("schema_name", "public");
          formData.set("table_name", "users");

          const submission = parseWithZod(formData, { schema: changeSchema });

          expect(submission).toEqual({
            error: {
              primary_keys: ["Array must contain at least 1 element(s)"],
            },
            payload: {
              action: "DELETE",
              schema_name: "public",
              table_name: "users",
            },
            reply: expect.any(Function),
            status: "error",
          });
        });
      });
    });
  });
});
