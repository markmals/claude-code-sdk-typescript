/** biome-ignore-all lint/suspicious/noExplicitAny: Necessary for private member access */
import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { CLINotFoundError, query } from "../src/index.ts";
import { SubprocessCLITransport } from "../src/internal/subprocess-cli.ts";
import type {
    AssistantMessage,
    ClaudeCodeOptions,
    Message,
    ResultMessage,
    ToolUseBlock,
} from "../src/types.ts";

describe("Integration Tests", () => {
    it("should handle simple query response", async t => {
        // Mock the transport's receiveMessages method
        const mockMessages = [
            {
                type: "assistant",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "2 + 2 equals 4" }],
                },
            },
            {
                type: "result",
                subtype: "success",
                duration_ms: 1000,
                duration_api_ms: 800,
                is_error: false,
                num_turns: 1,
                session_id: "test-session",
                total_cost_usd: 0.001,
            },
        ];

        t.mock.method(SubprocessCLITransport.prototype, "connect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "disconnect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "receiveMessages", async function* () {
            for (const msg of mockMessages) {
                yield msg;
            }
        });

        const messages: Message[] = [];
        for await (const msg of query("What is 2 + 2?")) {
            messages.push(msg);
        }

        // Verify results
        strictEqual(messages.length, 2);

        // Check assistant message
        strictEqual(messages[0].type, "assistant");
        const assistantMsg = messages[0] as AssistantMessage;
        strictEqual(assistantMsg.message.content.length, 1);
        strictEqual((assistantMsg.message.content[0] as any).text, "2 + 2 equals 4");

        // Check result message
        strictEqual(messages[1].type, "result");
        const resultMsg = messages[1] as ResultMessage;
        strictEqual(resultMsg.total_cost_usd, 0.001);
        strictEqual(resultMsg.session_id, "test-session");
    });

    it("should handle query with tool use", async t => {
        const mockMessages = [
            {
                type: "assistant",
                message: {
                    role: "assistant",
                    content: [
                        {
                            type: "text",
                            text: "Let me read that file for you.",
                        },
                        {
                            type: "tool_use",
                            id: "tool-123",
                            name: "Read",
                            input: { file_path: "/test.txt" },
                        },
                    ],
                },
            },
            {
                type: "result",
                subtype: "success",
                duration_ms: 1500,
                duration_api_ms: 1200,
                is_error: false,
                num_turns: 1,
                session_id: "test-session-2",
                total_cost_usd: 0.002,
            },
        ];

        t.mock.method(SubprocessCLITransport.prototype, "connect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "disconnect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "receiveMessages", async function* () {
            for (const msg of mockMessages) {
                yield msg;
            }
        });

        const messages: Message[] = [];
        const options: ClaudeCodeOptions = {
            allowed_tools: ["Read"],
        };

        for await (const msg of query("Read /test.txt", options)) {
            messages.push(msg);
        }

        // Verify results
        strictEqual(messages.length, 2);

        // Check assistant message with tool use
        strictEqual(messages[0].type, "assistant");
        const assistantMsg = messages[0] as AssistantMessage;
        strictEqual(assistantMsg.message.content.length, 2);
        strictEqual(
            (assistantMsg.message.content[0] as any).text,
            "Let me read that file for you.",
        );

        const toolUse = assistantMsg.message.content[1] as ToolUseBlock;
        strictEqual(toolUse.type, "tool_use");
        strictEqual(toolUse.name, "Read");
        strictEqual(toolUse.input.file_path, "/test.txt");
    });

    it("should throw CLINotFoundError when CLI not found", async t => {
        // Mock findCLI to return a fake path so constructor doesn't throw
        t.mock.method(SubprocessCLITransport.prototype as any, "findCLI", () => "/mock/claude");

        // Mock the transport connect to throw
        t.mock.method(SubprocessCLITransport.prototype, "connect", async () => {
            throw new CLINotFoundError("Claude Code not found");
        });

        await rejects(async () => {
            // Consume the iterator to trigger the error
            const messages = [];
            for await (const msg of query("test")) {
                messages.push(msg);
            }
        }, CLINotFoundError);
    });

    it("should handle continuation option", async t => {
        const mockMessages = [
            {
                type: "assistant",
                message: {
                    role: "assistant",
                    content: [
                        {
                            type: "text",
                            text: "Continuing from previous conversation",
                        },
                    ],
                },
            },
        ];

        let capturedOptions: ClaudeCodeOptions | undefined;

        // Mock findCLI to return a fake path
        t.mock.method(SubprocessCLITransport.prototype as any, "findCLI", () => "/mock/claude");

        t.mock.method(
            SubprocessCLITransport.prototype,
            "connect",
            async function (this: SubprocessCLITransport) {
                // Access options from this instance
                capturedOptions = (this as any).options;
            },
        );
        t.mock.method(SubprocessCLITransport.prototype, "disconnect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "receiveMessages", async function* () {
            for (const msg of mockMessages) {
                yield msg;
            }
        });

        const messages: Message[] = [];
        const options: ClaudeCodeOptions = {
            continue_conversation: true,
        };

        for await (const msg of query("Continue", options)) {
            messages.push(msg);
        }

        // Verify transport was created with continuation option
        ok(capturedOptions);
        strictEqual(capturedOptions.continue_conversation, true);
    });

    it("should handle streaming multiple messages", async t => {
        const mockMessages = [
            {
                type: "assistant",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "First message" }],
                },
            },
            {
                type: "assistant",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "Second message" }],
                },
            },
            {
                type: "result",
                subtype: "success",
                duration_ms: 2000,
                duration_api_ms: 1800,
                is_error: false,
                num_turns: 2,
                session_id: "test-session-3",
                total_cost_usd: 0.003,
            },
        ];

        t.mock.method(SubprocessCLITransport.prototype, "connect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "disconnect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "receiveMessages", async function* () {
            for (const msg of mockMessages) {
                yield msg;
            }
        });

        const messages: Message[] = [];
        for await (const msg of query("Multiple responses")) {
            messages.push(msg);
        }

        // Verify all messages received
        strictEqual(messages.length, 3);
        strictEqual(messages[0].type, "assistant");
        strictEqual(messages[1].type, "assistant");
        strictEqual(messages[2].type, "result");

        const resultMsg = messages[2] as ResultMessage;
        strictEqual(resultMsg.num_turns, 2);
    });

    it("should pass through all options correctly", async t => {
        let capturedPrompt: string | undefined;
        let capturedOptions: ClaudeCodeOptions | undefined;

        // Mock findCLI to bypass CLI check
        t.mock.method(SubprocessCLITransport.prototype as any, "findCLI", () => "/mock/claude");

        // Capture the options by mocking the connect method
        t.mock.method(
            SubprocessCLITransport.prototype,
            "connect",
            async function (this: SubprocessCLITransport) {
                // Access prompt and options from this instance
                capturedPrompt = (this as any).prompt;
                capturedOptions = (this as any).options;
            },
        );
        t.mock.method(SubprocessCLITransport.prototype, "disconnect", async () => {});
        t.mock.method(SubprocessCLITransport.prototype, "receiveMessages", async function* () {
            yield {
                type: "assistant",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "Done" }],
                },
            };
        });

        const options: ClaudeCodeOptions = {
            allowed_tools: ["Read", "Write"],
            disallowed_tools: ["Bash"],
            system_prompt: "Test system prompt",
            append_system_prompt: "Additional instructions",
            permission_mode: "bypassPermissions",
            max_turns: 10,
            model: "claude-3-5-sonnet",
            cwd: "/test/directory",
            max_thinking_tokens: 5000,
            mcp_tools: ["tool1"],
            mcp_servers: {
                server1: {
                    transport: ["node", "test.js"],
                    env: { KEY: "value" },
                },
            },
        };

        const messages: Message[] = [];
        for await (const msg of query("Test prompt", options)) {
            messages.push(msg);
        }

        // Verify all options were passed correctly
        strictEqual(capturedPrompt, "Test prompt");
        deepStrictEqual(capturedOptions, options);
    });
});
