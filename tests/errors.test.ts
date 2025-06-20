import { ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
    CLIConnectionError,
    CLIJSONDecodeError,
    CLINotFoundError,
    ClaudeSDKError,
    ProcessError,
} from "../src/errors.ts";

describe("Error Types", () => {
    it("should create base ClaudeSDKError", () => {
        const error = new ClaudeSDKError("Something went wrong");
        strictEqual(error.message, "Something went wrong");
        ok(error instanceof Error);
        ok(error instanceof ClaudeSDKError);
    });

    it("should create CLINotFoundError", () => {
        const error = new CLINotFoundError("Claude Code not found");
        ok(error instanceof ClaudeSDKError);
        ok(error instanceof CLIConnectionError);
        ok(error.message.includes("Claude Code not found"));
    });

    it("should create CLINotFoundError with path", () => {
        const error = new CLINotFoundError("Not found", "/path/to/cli");
        strictEqual(error.message, "Not found: /path/to/cli");
    });

    it("should create CLIConnectionError", () => {
        const error = new CLIConnectionError("Failed to connect to CLI");
        ok(error instanceof ClaudeSDKError);
        ok(error.message.includes("Failed to connect to CLI"));
    });

    it("should create ProcessError with exit code and stderr", () => {
        const error = new ProcessError("Process failed", 1, "Command not found");
        strictEqual(error.exitCode, 1);
        strictEqual(error.stderr, "Command not found");
        ok(error.message.includes("Process failed"));
        ok(error.message.includes("exit code: 1"));
        ok(error.message.includes("Command not found"));
    });

    it("should create ProcessError without exit code", () => {
        const error = new ProcessError("Process failed");
        strictEqual(error.exitCode, undefined);
        strictEqual(error.stderr, undefined);
        strictEqual(error.message, "Process failed");
    });

    it("should create CLIJSONDecodeError", () => {
        const originalError = new Error("Unexpected token");
        const error = new CLIJSONDecodeError("{invalid json}", originalError);
        strictEqual(error.line, "{invalid json}");
        strictEqual(error.originalError, originalError);
        ok(error.message.includes("Failed to decode JSON"));
        ok(error.message.includes("{invalid json}"));
    });

    it("should truncate long JSON lines in CLIJSONDecodeError", () => {
        const longLine = "a".repeat(200);
        const originalError = new Error("Parse error");
        const error = new CLIJSONDecodeError(longLine, originalError);
        strictEqual(error.line, longLine);
        ok(error.message.includes("..."));
        ok(error.message.length < longLine.length);
    });
});
