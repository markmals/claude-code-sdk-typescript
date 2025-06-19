#!/usr/bin/env node
/**
 * Quick start example for Claude Code SDK.
 */

import {
    type AssistantMessage,
    type ClaudeCodeOptions,
    query,
    type ResultMessage,
    type TextBlock,
} from "../src/index";

async function basicExample(): Promise<void> {
    /**
     * Basic example - simple question.
     */
    console.log("=== Basic Example ===");

    for await (const message of query("What is 2 + 2?")) {
        if (message.type === "assistant") {
            const assistantMessage = message as AssistantMessage;
            for (const block of assistantMessage.message.content) {
                if (block.type === "text") {
                    const textBlock = block as TextBlock;
                    console.log(`Claude: ${textBlock.text}`);
                }
            }
        }
    }
    console.log();
}

async function withOptionsExample(): Promise<void> {
    /**
     * Example with custom options.
     */
    console.log("=== With Options Example ===");

    const options: ClaudeCodeOptions = {
        system_prompt: "You are a helpful assistant that explains things simply.",
        max_turns: 1,
    };

    for await (const message of query("Explain what TypeScript is in one sentence.", options)) {
        if (message.type === "assistant") {
            const assistantMessage = message as AssistantMessage;
            for (const block of assistantMessage.message.content) {
                if (block.type === "text") {
                    const textBlock = block as TextBlock;
                    console.log(`Claude: ${textBlock.text}`);
                }
            }
        }
    }
    console.log();
}

async function withToolsExample(): Promise<void> {
    /**
     * Example using tools.
     */
    console.log("=== With Tools Example ===");

    const options: ClaudeCodeOptions = {
        allowed_tools: ["Read", "Write"],
        system_prompt: "You are a helpful file assistant.",
    };

    for await (const message of query(
        "Create a file called hello.txt with 'Hello, World!' in it",
        options,
    )) {
        if (message.type === "assistant") {
            const assistantMessage = message as AssistantMessage;
            for (const block of assistantMessage.message.content) {
                if (block.type === "text") {
                    const textBlock = block as TextBlock;
                    console.log(`Claude: ${textBlock.text}`);
                }
            }
        } else if (message.type === "result") {
            const resultMessage = message as ResultMessage;
            if (resultMessage.total_cost_usd && resultMessage.total_cost_usd > 0) {
                console.log(`\nCost: $${resultMessage.total_cost_usd.toFixed(4)}`);
            }
        }
    }
    console.log();
}

async function main(): Promise<void> {
    /**
     * Run all examples.
     */
    await basicExample();
    await withOptionsExample();
    await withToolsExample();
}

// Run the main function
main().catch(console.error);
