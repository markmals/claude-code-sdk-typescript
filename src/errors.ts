export class ClaudeSDKError extends Error {}

export class CLIConnectionError extends ClaudeSDKError {}

export class CLINotFoundError extends CLIConnectionError {
    constructor(message = "Claude Code not found", cliPath?: string) {
        super(cliPath ? `${message}: ${cliPath}` : message);
    }
}

export class ProcessError extends ClaudeSDKError {
    exitCode?: number;
    stderr?: string;

    constructor(message: string, exitCode?: number, stderr?: string) {
        super(exitCode !== undefined ? `${message} (exit code: ${exitCode})` : message);
        this.exitCode = exitCode;
        this.stderr = stderr;
        if (stderr) this.message += `\nError output: ${stderr}`;
    }
}

export class CLIJSONDecodeError extends ClaudeSDKError {
    line: string;
    originalError: Error;

    constructor(line: string, originalError: Error) {
        super(`Failed to decode JSON: ${line.slice(0, 100)}...`);
        this.line = line;
        this.originalError = originalError;
    }
}
