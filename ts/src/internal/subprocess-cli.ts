import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import readline from "node:readline";
import type { Readable } from "node:stream";
import { CLIConnectionError, CLIJSONDecodeError, CLINotFoundError, ProcessError } from "../errors";
import type { ClaudeCodeOptions } from "../types";
import type { Transport } from "./transport";

export class SubprocessCLITransport implements Transport {
    private process: ChildProcessWithoutNullStreams | null = null;
    private stdout?: Readable;
    private stderr?: Readable;

    constructor(
        private prompt: string,
        private options: ClaudeCodeOptions,
        private cliPath?: string | null,
    ) {
        this.cliPath = cliPath ?? this.findCLI();
    }

    private findCLI(): string {
        if (process.env.CLAUDE_CLI_PATH && existsSync(process.env.CLAUDE_CLI_PATH)) {
            return process.env.CLAUDE_CLI_PATH;
        }
        const fromPath = process.env.PATH?.split(":")
            .map(p => join(p, "claude"))
            .find(p => existsSync(p));
        if (fromPath) return fromPath;
        const home = process.env.HOME || "";
        const guesses = [
            `${home}/.npm-global/bin/claude`,
            "/usr/local/bin/claude",
            `${home}/.local/bin/claude`,
            `${home}/node_modules/.bin/claude`,
            `${home}/.yarn/bin/claude`,
        ];
        for (const p of guesses) {
            if (existsSync(p)) return p;
        }
        if (!existsSync("node")) {
            throw new CLINotFoundError(
                "Claude Code requires Node.js. Install Node.js then run: npm install -g @anthropic-ai/claude-code",
            );
        }
        throw new CLINotFoundError(
            "Claude Code not found. Install with: npm install -g @anthropic-ai/claude-code",
        );
    }

    private buildCommand() {
        const cmd = [this.cliPath!, "--output-format", "stream-json", "--verbose"];
        const o = this.options;
        if (o.system_prompt) {
            cmd.push("--system-prompt", o.system_prompt);
        }
        if (o.append_system_prompt) {
            cmd.push("--append-system-prompt", o.append_system_prompt);
        }
        if (o.allowed_tools?.length) {
            cmd.push("--allowedTools", o.allowed_tools.join(","));
        }
        if (o.max_turns) {
            cmd.push("--max-turns", String(o.max_turns));
        }
        if (o.disallowed_tools?.length) {
            cmd.push("--disallowedTools", o.disallowed_tools.join(","));
        }
        if (o.model) {
            cmd.push("--model", o.model);
        }
        if (o.permission_prompt_tool_name) {
            cmd.push("--permission-prompt-tool", o.permission_prompt_tool_name);
        }
        if (o.permission_mode) {
            cmd.push("--permission-mode", o.permission_mode);
        }
        if (o.continue_conversation) {
            cmd.push("--continue");
        }
        if (o.resume) {
            cmd.push("--resume", o.resume);
        }
        if (o.mcp_servers) {
            cmd.push("--mcp-config", JSON.stringify({ mcpServers: o.mcp_servers }));
        }
        cmd.push("--print", this.prompt);
        return cmd;
    }

    async connect() {
        if (this.process) return;
        const cmd = this.buildCommand();
        try {
            this.process = spawn(cmd[0], cmd.slice(1), {
                cwd: this.options.cwd ? resolve(this.options.cwd) : undefined,
                env: {
                    ...process.env,
                    CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
                },
            });
            this.stdout = this.process.stdout;
            this.stderr = this.process.stderr;
        } catch (err: any) {
            if (err.code === "ENOENT") {
                throw new CLINotFoundError("", this.cliPath || "");
            }
            throw new CLIConnectionError(`Failed to start Claude Code: ${err}`);
        }
    }

    async disconnect() {
        if (!this.process) return;
        if (!this.process.killed) {
            this.process.kill();
        }
        this.process = null;
        this.stdout = undefined;
        this.stderr = undefined;
    }

    async sendRequest(): Promise<void> {
        // not used; CLI args only
    }

    async *receiveMessages(): AsyncIterable<Record<string, any>> {
        if (!this.process || !this.stdout) {
            throw new CLIConnectionError("Not connected");
        }
        const rl = readline.createInterface({ input: this.stdout });
        const stderrLines: string[] = [];
        if (this.stderr) {
            readline.createInterface({ input: this.stderr }).on("line", l => stderrLines.push(l));
        }
        for await (const line of rl) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const data = JSON.parse(trimmed);
                yield data;
            } catch (e: any) {
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    throw new CLIJSONDecodeError(trimmed, e);
                }
            }
        }
        await new Promise<void>(resolve => this.process!.once("close", () => resolve()));
        if (this.process!.exitCode && this.process!.exitCode !== 0) {
            throw new ProcessError(
                "CLI process failed",
                this.process!.exitCode,
                stderrLines.join("\n"),
            );
        }
    }

    isConnected() {
        return !!this.process && !this.process.killed;
    }
}
