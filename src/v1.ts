import * as v from "valibot";

export const LogLevel = v.picklist([
  "info",
  "warn",
  "error",
  "fatal",
]);
export type LogLevel = v.InferOutput<typeof LogLevel>;

const logBase = {
  code: v.optional(v.string()),
  message: v.optional(v.string()),
};

export const Log = v.object({
  ...logBase,
});
export type Log = v.InferOutput<typeof Log>;

export const APIAuthResponse = v.object({
  token: v.string(),
  expires: v.number(),
});
export type APIAuthResponse = v.InferOutput<typeof APIAuthResponse>;

export const APIPushRequest = v.object({
  ...logBase,
  level: LogLevel,
  filename: v.optional(v.string()),
  line: v.optional(v.number()),
  column: v.optional(v.number()),
});
export type APIPushRequest = v.InferInput<typeof APIPushRequest>;
