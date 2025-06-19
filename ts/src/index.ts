export {
  ClaudeSDKError,
  CLIConnectionError,
  CLIJSONDecodeError,
  CLINotFoundError,
  ProcessError,
} from "./errors";
export type {
  AssistantMessage,
  ClaudeCodeOptions,
  ContentBlock,
  Message,
  PermissionMode,
  ResultMessage,
  SystemMessage,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
  UserMessage,
} from "./types";

import { InternalClient } from "./internal/client";
import type { ClaudeCodeOptions as Options, Message as Msg } from "./types";

export async function* query(
  prompt: string,
  options: Options = {},
): AsyncIterable<Msg> {
  const client = new InternalClient();
  for await (const m of client.processQuery(prompt, options)) {
    yield m;
  }
}

export class QueryEventTarget extends EventTarget {
  private abortController = new AbortController();

  constructor(prompt: string, options: Options = {}) {
    super();
    void this.start(prompt, options);
  }

  private async start(prompt: string, options: Options) {
    try {
      for await (const msg of query(prompt, options)) {
        this.dispatchEvent(new MessageEvent("message", { data: msg }));
        if (this.abortController.signal.aborted) break;
      }
      this.dispatchEvent(new Event("end"));
    } catch (err) {
      this.dispatchEvent(new ErrorEvent("error", { error: err }));
    }
  }

  abort() {
    this.abortController.abort();
  }
}
