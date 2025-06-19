/** biome-ignore-all lint/correctness/useYield: Not necessary for tests */
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { QueryEventTarget, query } from "../src/index.ts";
import { InternalClient } from "../src/internal/client.ts";
import type {
    AssistantMessage,
    ClaudeCodeOptions,
    Message,
    ResultMessage,
    TextBlock,
} from "../src/types.ts";

describe("Query Function", () => {
    it("should handle single prompt", async t => {
        const mockMessages: Message[] = [
            {
                type: "assistant",
                message: {
                    content: [{ type: "text", text: "4" }],
                },
            } as AssistantMessage,
        ];

        t.mock.method(InternalClient.prototype, "processQuery", async function* () {
            for (const msg of mockMessages) {
                yield msg;
            }
        });

        const messages: Message[] = [];
        for await (const msg of query("What is 2+2?")) {
            messages.push(msg);
        }

        strictEqual(messages.length, 1);
        strictEqual(messages[0].type, "assistant");
        const assistantMsg = messages[0] as AssistantMessage;
        strictEqual(assistantMsg.message.content[0].type, "text");
        strictEqual((assistantMsg.message.content[0] as TextBlock).text, "4");
    });

    it("should handle query with options", async t => {
        const options: ClaudeCodeOptions = {
            allowed_tools: ["Read", "Write"],
            system_prompt: "You are helpful",
            permission_mode: "acceptEdits",
            max_turns: 5,
        };

        let capturedPrompt: string | undefined;
        let capturedOptions: ClaudeCodeOptions | undefined;

        t.mock.method(
            InternalClient.prototype,
            "processQuery",
            async function* (prompt: string, opts: ClaudeCodeOptions) {
                capturedPrompt = prompt;
                capturedOptions = opts;
                yield {
                    type: "assistant",
                    message: {
                        content: [{ type: "text", text: "Hello!" }],
                    },
                } as AssistantMessage;
            },
        );

        const messages: Message[] = [];
        for await (const msg of query("Hi", options)) {
            messages.push(msg);
        }

        strictEqual(capturedPrompt, "Hi");
        deepStrictEqual(capturedOptions, options);
        strictEqual(messages.length, 1);
    });

    it("should handle custom working directory", async t => {
        const options: ClaudeCodeOptions = {
            cwd: "/custom/path",
        };

        const mockMessages: Message[] = [
            {
                type: "assistant",
                message: {
                    content: [{ type: "text", text: "Done" }],
                },
            } satisfies AssistantMessage,
            {
                type: "result",
                subtype: "success",
                duration_ms: 1000,
                duration_api_ms: 800,
                is_error: false,
                num_turns: 1,
                session_id: "test-session",
                total_cost_usd: 0.001,
            } satisfies ResultMessage,
        ];

        t.mock.method(InternalClient.prototype, "processQuery", async function* () {
            for (const msg of mockMessages) {
                yield msg;
            }
        });

        const messages: Message[] = [];
        for await (const msg of query("test", options)) {
            messages.push(msg);
        }

        strictEqual(messages.length, 2);
        strictEqual(messages[1].type, "result");
    });
});

describe("QueryEventTarget", () => {
    it("should emit message events", async t => {
        const mockMessages: Message[] = [
            {
                type: "assistant",
                message: {
                    content: [{ type: "text", text: "Hello" }],
                },
            } satisfies AssistantMessage,
            {
                type: "result",
                subtype: "success",
                duration_ms: 100,
                duration_api_ms: 80,
                is_error: false,
                num_turns: 1,
                session_id: "test",
                total_cost_usd: 0.001,
            } satisfies ResultMessage,
        ];

        t.mock.method(InternalClient.prototype, "processQuery", async function* () {
            for (const msg of mockMessages) {
                yield msg;
            }
        });

        const receivedMessages: Message[] = [];
        let endReceived = false;

        const target = new QueryEventTarget("test prompt");

        target.addEventListener("message", event => {
            receivedMessages.push(event.data);
        });

        target.addEventListener("end", () => {
            endReceived = true;
        });

        // Wait for messages to be processed
        await new Promise(resolve => setTimeout(resolve, 100));

        strictEqual(receivedMessages.length, 2);
        ok(endReceived);
    });

    it("should handle errors", async t => {
        const testError = new Error("Test error");

        t.mock.method(InternalClient.prototype, "processQuery", async function* () {
            throw testError;
        });

        let errorReceived: unknown;

        const target = new QueryEventTarget("test prompt");

        target.addEventListener("error", event => {
            errorReceived = event.error;
        });

        // Wait for error to be processed
        await new Promise(resolve => setTimeout(resolve, 100));

        ok(errorReceived);
        strictEqual(errorReceived, testError);
    });

    it("should support abort", async t => {
        t.mock.method(InternalClient.prototype, "processQuery", async function* () {
            yield {
                type: "assistant",
                message: {
                    content: [{ type: "text", text: "Message 1" }],
                },
            } satisfies AssistantMessage;

            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 50));

            yield {
                type: "assistant",
                message: {
                    content: [{ type: "text", text: "Message 2" }],
                },
            } satisfies AssistantMessage;
        });

        const receivedMessages: Message[] = [];

        const target = new QueryEventTarget("test prompt");

        target.addEventListener("message", event => {
            receivedMessages.push(event.data);
            if (receivedMessages.length === 1) {
                target.abort();
            }
        });

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should have received only one message due to abort
        strictEqual(receivedMessages.length, 1);
    });
});
