export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export interface McpServerConfig {
    transport: string[];
    env?: Record<string, any>;
}

export interface TextBlock {
    type: "text";
    text: string;
}

export interface ToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, any>;
}

export interface ToolResultBlock {
    type: "tool_result";
    tool_use_id: string;
    content?: string | Record<string, any>[] | null;
    is_error?: boolean | null;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface UserMessage {
    type: "user";
    message: {
        content: string;
    };
}

export interface AssistantMessage {
    type: "assistant";
    message: {
        content: ContentBlock[];
    };
}

export interface SystemMessage {
    type: "system";
    subtype: string;
    data: Record<string, any>;
}

export interface ResultMessage {
    type: "result";
    subtype: string;
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    session_id: string;
    total_cost_usd?: number;
    usage?: Record<string, any>;
    result?: string;
}

export type Message = UserMessage | AssistantMessage | SystemMessage | ResultMessage;

export interface ClaudeCodeOptions {
    allowed_tools?: string[];
    max_thinking_tokens?: number;
    system_prompt?: string;
    append_system_prompt?: string;
    mcp_tools?: string[];
    mcp_servers?: Record<string, McpServerConfig>;
    permission_mode?: PermissionMode;
    continue_conversation?: boolean;
    resume?: string;
    max_turns?: number;
    disallowed_tools?: string[];
    model?: string;
    permission_prompt_tool_name?: string;
    cwd?: string;
}
