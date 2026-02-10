import { getCallSites } from "node:util";
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

    console.log(`[@harrsoft/logger] Initialized logger (${this.serverUrl})`);
  }

  info(message: string) {
    this.pushLog("info", message);
  }

  warn(message: string) {
    this.pushLog("warn", message);
  }

  error(message: string) {
    this.pushLog("error", message);
  }

  fatal(message: string) {
    this.pushLog("fatal", message);
  }

  private async authenticate() {
    if (!this.tokenExpiresAt || df.isPast(this.tokenExpiresAt)) {
      // fetch new token
      const res = await this.fetch(this.authUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic key:${this.apiKey}`,
        },
      });

      try {
        const answer = v.parse(v1.APIAuthResponse, await res.json());
        this.token = answer.token;
        this.tokenExpiresAt = df.fromUnixTime(answer.expires);
      } catch (e) {
        console.error(
          "[@harrsoft/logger] Failed to authenticate:",
          `${res.status}: ${res.statusText}`,
        );
        throw e;
      }
    }
  }

  private async pushLog(level: v1.LogLevel, message: string) {
    // get call stack
    // skip first site (this function),
    // skip second site (info, warn. error, or fatal call)
    const callSite = getCallSites({ sourceMap: true }).slice(2)[0];

    if (!callSite) {
      console.warn("[@harrsoft/logger] Could not determine call site");
    }

    try {
      await this.authenticate();

      await this.fetch(this.pushUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + this.token,
        },
        body: JSON.stringify(
          v.parse(v1.APIPushRequest, {
            level,
            message,
            file: callSite?.scriptName,
            function: callSite?.functionName,
            line: callSite?.lineNumber,
            column: callSite?.columnNumber,
          } satisfies v1.APIPushRequest),
        ),
      });
    } catch (e) {
      console.error("[@harrsoft/logger] Could not deliver log:", e);
    }
  }
}
