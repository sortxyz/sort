import { z } from "zod";

export const slugSchema = z
  .string()
  .min(2)
  .regex(/^[a-z0-9]+[-_a-z0-9]*$/);
