/** biome-ignore-all lint/suspicious/noExplicitAny: Needed to access private properties */
import { deepStrictEqual, ok, rejects, strictEqual, throws } from "node:assert";
import { describe, it, mock } from "node:test";
import { CLINotFoundError, ProcessError } from "../src/errors.ts";
import { SubprocessCLITransport } from "../src/internal/subprocess-cli.ts";
import type { ClaudeCodeOptions } from "../src/types.ts";

describe("SubprocessCLITransport", () => {
    it("should throw CLINotFoundError when CLI not found", () => {
        // Mock environment and filesystem
        const originalPath = process.env.PATH;
        const originalHome = process.env.HOME;
        const originalCLIPath = process.env.CLAUDE_CLI_PATH;

        process.env.PATH = "";
        process.env.HOME = "/nonexistent";
        delete process.env.CLAUDE_CLI_PATH;

        try {
            throws(() => {
                new SubprocessCLITransport("test", {});
            }, CLINotFoundError);
        } finally {
            // Restore environment
            process.env.PATH = originalPath;
            process.env.HOME = originalHome;
            if (originalCLIPath) {
                process.env.CLAUDE_CLI_PATH = originalCLIPath;
            }
        }
    });

    it("should build basic command", () => {
        const transport = new SubprocessCLITransport("Hello", {}, "/usr/bin/claude");

        const cmd = (transport as any).buildCommand();
        strictEqual(cmd[0], "/usr/bin/claude");
        ok(cmd.includes("--output-format"));
        ok(cmd.includes("stream-json"));
        ok(cmd.includes("--print"));
        ok(cmd.includes("Hello"));
        ok(cmd.includes("--verbose"));
    });

    it("should accept pathlib-like paths", () => {
        const transport = new SubprocessCLITransport("Hello", {}, "/usr/bin/claude");
        strictEqual((transport as any).cliPath, "/usr/bin/claude");
    });

    it("should build command with options", () => {
        const options: ClaudeCodeOptions = {
            system_prompt: "Be helpful",
            allowed_tools: ["Read", "Write"],
            disallowed_tools: ["Bash"],
            model: "claude-3-5-sonnet",
            permission_mode: "acceptEdits",
            max_turns: 5,
        };

        const transport = new SubprocessCLITransport("test", options, "/usr/bin/claude");

        const cmd = (transport as any).buildCommand();
        ok(cmd.includes("--system-prompt"));
        ok(cmd.includes("Be helpful"));
        ok(cmd.includes("--allowedTools"));
        ok(cmd.includes("Read,Write"));
        ok(cmd.includes("--disallowedTools"));
        ok(cmd.includes("Bash"));
        ok(cmd.includes("--model"));
        ok(cmd.includes("claude-3-5-sonnet"));
        ok(cmd.includes("--permission-mode"));
        ok(cmd.includes("acceptEdits"));
        ok(cmd.includes("--max-turns"));
        ok(cmd.includes("5"));
    });

    it("should handle session continuation options", () => {
        const options: ClaudeCodeOptions = {
            continue_conversation: true,
            resume: "session-123",
        };

        const transport = new SubprocessCLITransport(
            "Continue from before",
            options,
            "/usr/bin/claude",
        );

        const cmd = (transport as any).buildCommand();
        ok(cmd.includes("--continue"));
        ok(cmd.includes("--resume"));
        ok(cmd.includes("session-123"));
    });

    it("should handle MCP server configuration", () => {
        const options: ClaudeCodeOptions = {
            mcp_servers: {
                testServer: {
                    transport: ["node", "server.js"],
                    env: { API_KEY: "test" },
                },
            },
        };

        const transport = new SubprocessCLITransport("test", options, "/usr/bin/claude");

        const cmd = (transport as any).buildCommand();
        ok(cmd.includes("--mcp-config"));
        const mcpConfigIndex = cmd.indexOf("--mcp-config");
        if (mcpConfigIndex !== -1) {
            const mcpConfig = JSON.parse(cmd[mcpConfigIndex + 1]);
            deepStrictEqual(mcpConfig.mcpServers.testServer, {
                transport: ["node", "server.js"],
                env: { API_KEY: "test" },
            });
        }
    });

    it("should connect and disconnect", async t => {
        const transport = new SubprocessCLITransport("test", {}, "/usr/bin/claude");

        const mockProcess = {
            stdout: { on: () => {} },
            stderr: { on: () => {} },
            kill: mock.fn(),
            killed: false,
            once: mock.fn(),
        };

        // Override the connect method to set up our mock process
        t.mock.method(transport, "connect", async function (this: SubprocessCLITransport) {
            (this as any).process = mockProcess;
            (this as any).stdout = mockProcess.stdout;
            (this as any).stderr = mockProcess.stderr;
        });

        await transport.connect();
        ok(transport.isConnected());

        await transport.disconnect();
        strictEqual(mockProcess.kill.mock.calls.length, 1);
    });

    it("should handle spawn errors", async t => {
        const spawnStub = t.mock.fn(() => {
            throw Object.assign(new Error("spawn failed"), { code: "ENOENT" });
        });

        t.mock.module("node:child_process", { namedExports: { spawn: spawnStub } });

        const freshUrl =
            new URL("../src/internal/subprocess-cli.ts", import.meta.url).href +
            `?test=${Date.now()}`;
        const { SubprocessCLITransport } = await import(freshUrl);

        const transport = new SubprocessCLITransport("test", {}, "/usr/bin/claude");

        await rejects(() => transport.connect(), CLINotFoundError);
        strictEqual(spawnStub.mock.callCount(), 1);
    });

    it("should parse JSON messages", async t => {
        const mockReadline = {
            on: t.mock.fn(),
            [Symbol.asyncIterator]: async function* () {
                yield '{"type": "assistant", "message": {"content": [{"type": "text", "text": "Hello"}]}}';
                yield '{"type": "result", "subtype": "success"}';
            },
        };

        const mockProcess = {
            stdout: {},
            stderr: {},
            kill: t.mock.fn(),
            killed: false,
            once: t.mock.fn((event: string, cb: () => void) => {
                if (event === "close") setTimeout(() => cb(), 10);
            }),
            exitCode: 0,
        };

        const mockSpawn = t.mock.fn(() => mockProcess);
        const mockCreateInterface = t.mock.fn(() => mockReadline);

        t.mock.module("node:child_process", { namedExports: { spawn: mockSpawn } });
        t.mock.module("node:readline", { namedExports: { createInterface: mockCreateInterface } });

        const freshUrl =
            new URL("../src/internal/subprocess-cli.ts", import.meta.url).href +
            `?test=${Date.now()}`;
        const { SubprocessCLITransport } = await import(freshUrl);

        const transport = new SubprocessCLITransport("test", {}, "/usr/bin/claude");
        await transport.connect();

        const messages: any[] = [];
        for await (const msg of transport.receiveMessages()) {
            messages.push(msg);
        }

        strictEqual(messages.length, 2);
        strictEqual(messages[0].type, "assistant");
        strictEqual(messages[1].type, "result");
    });

    it("should handle process errors", async t => {
        const mockStderrReadline = {
            on: t.mock.fn((event: string, cb: (input: string) => void) => {
                if (event === "line") {
                    cb("Error: Command not found");
                }
            }),
        };

        const mockStdoutReadline = {
            [Symbol.asyncIterator]: async function* () {
                // Empty stdout
            },
        };

        const mockProcess = {
            stdout: {},
            stderr: {},
            kill: t.mock.fn(),
            killed: false,
            once: t.mock.fn((event: string, cb: () => void) => {
                if (event === "close") setTimeout(() => cb(), 10);
            }),
            exitCode: 1,
        };

        const mockSpawn = t.mock.fn(() => mockProcess);
        const mockCreateInterface = t.mock.fn((opts: any) => {
            if (opts.input === mockProcess.stderr) {
                return mockStderrReadline;
            }
            return mockStdoutReadline;
        });

        t.mock.module("node:child_process", { namedExports: { spawn: mockSpawn } });
        t.mock.module("node:readline", { namedExports: { createInterface: mockCreateInterface } });

        const freshUrl =
            new URL("../src/internal/subprocess-cli.ts", import.meta.url).href +
            `?test=${Date.now()}`;
        const { SubprocessCLITransport } = await import(freshUrl);

        const transport = new SubprocessCLITransport("test", {}, "/usr/bin/claude");
        await transport.connect();

        await rejects(async () => {
            const messages = [];
            for await (const msg of transport.receiveMessages()) {
                messages.push(msg);
            }
        }, ProcessError);
    });
});
