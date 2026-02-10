import { getCallSites } from "node:util";
import * as v from "valibot";

import * as v1 from "./v1";

const encodeB64 = (s: string): string => {
  return Buffer.from(s, "utf-8").toString("base64");
};

export interface LoggerInit {
  service: string;
  serverUrl: URL | string;
  keyId: string;
  apiKey: string;
  fetch?: typeof fetch;
}

export class Logger {
  private service: string;
  private serverUrl: URL;
  private keyId: string;
  private apiKey: string;
  private fetch: typeof fetch;

  private apiVersion = "/v1";

  private pushUrl: URL;

  constructor(init: LoggerInit) {
    this.service = init.service;
    this.keyId = init.keyId;
    this.apiKey = init.apiKey;
    this.serverUrl = new URL(this.apiVersion, init.serverUrl);
    this.pushUrl = new URL("/push", this.serverUrl);

    if (init.fetch) {
      this.fetch = init.fetch;
    } else {
      this.fetch = fetch;
    }

    console.log(`[@harrsoft/logger] Initialized logger (${this.serverUrl})`);
  }

  info(message: string) {
    this.postLog("info", message);
  }

  warn(message: string) {
    this.postLog("warn", message);
  }

  error(message: string) {
    this.postLog("error", message);
  }

  fatal(message: string) {
    this.postLog("fatal", message);
  }

  private async postLog(level: v1.LogLevel, message: string) {
    // get call stack
    // skip first site (this function),
    // skip second site (info, warn. error, or fatal call)
    const callSite = getCallSites({ sourceMap: true }).slice(2)[0];

    if (!callSite) {
      console.warn("[@harrsoft/logger] Could not determine call site");
    }

    const basicAuth = encodeB64(`${this.keyId}:${this.apiKey}`);
    try {
      await this.fetch(this.pushUrl, {
        method: "POST",
        headers: {
          Authorization: "Basic " + basicAuth,
        },
        body: JSON.stringify(
          v.parse(v1.APIPushRequest, {
            level,
            message,
            service: this.service,
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
