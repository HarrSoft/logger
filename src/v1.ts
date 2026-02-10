import * as v from "valibot";

export const LogLevel = v.picklist(["info", "warn", "error", "fatal"]);
export type LogLevel = v.InferOutput<typeof LogLevel>;

export const APIAuthResponse = v.object({
  token: v.string(),
  expires: v.number(),
});
export type APIAuthResponse = v.InferOutput<typeof APIAuthResponse>;

export const APIPushRequest = v.object({
  level: LogLevel,
  service: v.string(),
  message: v.string(),
  file: v.optional(v.string()),
  function: v.optional(v.string()),
  line: v.optional(v.number()),
  column: v.optional(v.number()),
});
export type APIPushRequest = v.InferInput<typeof APIPushRequest>;
