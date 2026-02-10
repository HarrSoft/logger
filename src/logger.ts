import * as df from "date-fns";
import * as v from "valibot";

import * as v1 from "./v1";

export interface LoggerInit {
  serverUrl: URL | string;
  apiKey: string;
  fetch?: typeof fetch;
}

export class Logger {
  private serverUrl: URL;
  private apiKey: string;
  private fetch: typeof fetch;

  private apiVersion = "/v1";
  private token: string | undefined;
  private tokenExpiresAt: Date | undefined;

  private authUrl: URL;
  private pushUrl: URL;

  constructor(init: LoggerInit) {
    this.apiKey = init.apiKey;
    this.serverUrl = new URL(this.apiVersion, init.serverUrl);
    this.authUrl = new URL("/auth", this.serverUrl);
    this.pushUrl = new URL("/push", this.serverUrl);

    if (init.fetch) {
      this.fetch = init.fetch;
    } else {
      this.fetch = fetch;
    }

    console.log(`[harrsoft logger] Initialized logger (${this.serverUrl})`);
  }

  info(log: v1.Log) {
    this.pushLog("info", log);
  }

  warn(log: v1.Log) {
    this.pushLog("warn", log);
  }

  error(log: v1.Log) {
    this.pushLog("error", log);
  }

  fatal(log: v1.Log) {
    this.pushLog("fatal", log);
  }

  private async authenticate() {
    if (!this.tokenExpiresAt || df.isPast(this.tokenExpiresAt)) {
      // fetch new token
      const res = await this.fetch(this.authUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic key:${this.apiKey}`,
        },
      });

      try {
        const answer = v.parse(v1.APIAuthResponse, await res.json());
        this.token = answer.token;
        this.tokenExpiresAt = df.fromUnixTime(answer.expires);
      } catch (e) {
        console.error(
          "[harrsoft logger] Failed to authenticate:",
          `${res.status}: ${res.statusText}`,
        );
        throw e;
      }
    }
  }

  private async pushLog(level: v1.LogLevel, log: v1.Log) {
    // get call stack
    // skip first line "Error",
    // second line (this function),
    // and third line (info, warn. error, or fatal call)
    const stackLine = new Error().stack?.split("\n").slice(3)[0] || "";
    const match = stackLine.match(/at .+ \((file:\/\/)?(.+):(\d+):(\d+)\)/);
    const filename = match?.[2];
    const line = match && match[3] ? parseInt(match[3], 10) : undefined;
    const column = match && match[4] ? parseInt(match[4], 10) : undefined;

    if (!filename) {
      console.warn(
        "[harrsoft logger] Could not determine stack trace from ",
        new Error().stack,
      );
    }

    try {
      await this.authenticate();

      await this.fetch(this.pushUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + this.token,
        },
        body: JSON.stringify(v.parse(v1.APIPushRequest, {
          code: log.code,
          message: log.message,
          level,
          filename,
          line,
          column,
        } satisfies v1.APIPushRequest)),
      });
    } catch (e) {
      console.error("[harrsoft logger] Could not deliver log:", e);
    }
  }
}
