import { z } from 'zod';

/** Any JSON object — default when callers omit a schema. */
export const jsonRecordSchema = z.record(z.string(), z.unknown());

/** Any JSON value — arrays, objects, primitives (catalog hub responses). */
export const jsonAnySchema = z.unknown();

export type JsonRecord = z.infer<typeof jsonRecordSchema>;

/** Standard Koko Bay `{ ok: true }` envelope. */
export const apiOkSchema = z.object({
  ok: z.literal(true),
});

/** Standard Koko Bay error envelope. */
export const apiErrorBodySchema = z.object({
  ok: z.literal(false).optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export function parseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  return schema.parse(data);
}

export function safeParseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
) {
  return schema.safeParse(data);
}
