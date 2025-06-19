import type {
  AssistantMessage,
  ClaudeCodeOptions,
  ContentBlock,
  Message,
  ResultMessage,
  SystemMessage,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
  UserMessage,
} from "../types";
import { SubprocessCLITransport } from "./subprocess-cli";
import type { Transport } from "./transport";

export class InternalClient {
  async *processQuery(
    prompt: string,
    options: ClaudeCodeOptions,
  ): AsyncIterable<Message> {
    const transport: Transport = new SubprocessCLITransport(prompt, options);
    await transport.connect();
    try {
      for await (const data of transport.receiveMessages()) {
        const msg = this.parseMessage(data);
        if (msg) yield msg;
      }
    } finally {
      await transport.disconnect();
    }
  }

  private parseMessage(data: any): Message | null {
    switch (data.type) {
      case "user":
        return {
          type: "user",
          message: { content: data.message.content },
        } as UserMessage;
      case "assistant": {
        const content: ContentBlock[] = [];
        for (const block of data.message.content) {
          switch (block.type) {
            case "text":
              content.push({ type: "text", text: block.text } as TextBlock);
              break;
            case "tool_use":
              content.push({
                type: "tool_use",
                id: block.id,
                name: block.name,
                input: block.input,
              } as ToolUseBlock);
              break;
            case "tool_result":
              content.push({
                type: "tool_result",
                tool_use_id: block.tool_use_id,
                content: block.content,
                is_error: block.is_error,
              } as ToolResultBlock);
              break;
          }
        }
        return { type: "assistant", message: { content } } as AssistantMessage;
      }
      case "system":
        return { type: "system", subtype: data.subtype, data } as SystemMessage;
      case "result":
        return {
          type: "result",
          subtype: data.subtype,
          duration_ms: data.duration_ms,
          duration_api_ms: data.duration_api_ms,
          is_error: data.is_error,
          num_turns: data.num_turns,
          session_id: data.session_id,
          total_cost_usd: data.total_cost_usd,
          usage: data.usage,
          result: data.result,
        } as ResultMessage;
      default:
        return null;
    }
  }
}
