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
    // do some hacks to get the stack trace
    const oldPrepare = Error.prepareStackTrace;
    Error.prepareStackTrace = (_err, callSites) => callSites;
    let s: { stack: NodeJS.CallSite[] } = {} as any;
    Error.captureStackTrace(s, this.postLog);
    Error.prepareStackTrace = oldPrepare;

    if (!s.stack) {
      console.warn("[@harrsoft/logger] Could not determine call site");
    }

    // get the caller of info, warn, error, or fatal
    const caller = s.stack[1];
    const line =
      caller?.getLineNumber() !== null ?
        (caller!.getLineNumber() as number)
      : undefined;
    const column =
      caller?.getColumnNumber() !== null ?
        (caller!.getColumnNumber() as number)
      : undefined;

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
            file: caller?.getFileName() || undefined,
            function: caller?.getFunctionName() || undefined,
            line,
            column,
          } satisfies v1.APIPushRequest),
        ),
      });
    } catch (e) {
      console.error("[@harrsoft/logger] Could not deliver log:", e);
    }
  }
}
