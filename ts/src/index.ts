export {
    CLIConnectionError,
    CLIJSONDecodeError,
    CLINotFoundError,
    ClaudeSDKError,
    ProcessError,
} from "./errors.ts";
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
} from "./types.ts";

import { ErrorEvent } from "./error-event.ts";
import { GenericEventTarget } from "./generic-event-target.ts";
import { InternalClient } from "./internal/client.ts";
import type { Message, ClaudeCodeOptions as Options } from "./types.ts";

export async function* query(prompt: string, options: Options = {}): AsyncIterable<Message> {
    const client = new InternalClient();
    for await (const message of client.processQuery(prompt, options)) {
        yield message;
    }
}

type QueryEventMap = {
    message: MessageEvent<Message>;
    end: Event;
    error: ErrorEvent;
};

export class QueryEventTarget extends GenericEventTarget<QueryEventMap> {
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
