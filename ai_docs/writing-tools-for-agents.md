# Writing Effective Tools for Agents — with Agents

**Published:** September 11, 2025

## Overview

This Anthropic engineering article explores best practices for developing high-quality tools that LLM agents can effectively use. The piece emphasizes that "agents are only as effective as the tools we give them" and provides a comprehensive framework for building, evaluating, and optimizing tools.

## Key Sections

### What is a Tool?

The article distinguishes tools from traditional software by explaining that tools bridge deterministic systems and non-deterministic agents. Unlike conventional functions that produce identical outputs given identical inputs, tools must account for agents' variable responses and occasional failures in tool usage.

### How to Write Tools

The methodology involves three iterative phases:

1. **Building Prototypes** - Start with quick implementations, using Claude Code and local MCP servers for testing. The guide recommends providing LLM-friendly documentation from sources like `llms.txt` files.

2. **Running Evaluations** - Create diverse evaluation tasks grounded in real-world workflows. Examples include complex multi-step scenarios like scheduling meetings with document attachments or investigating customer billing issues.

3. **Collaborating with Agents** - Use Claude Code to analyze evaluation transcripts and automatically improve tool implementations. The authors note their advice came from repeated optimization cycles.

## Principles for Writing Effective Tools

### Choosing the Right Tools

Rather than wrapping every API endpoint, focus on high-impact workflows. The article suggests consolidating functionality—for instance, implementing a `schedule_event` tool that handles availability checking rather than separate `list_users`, `list_events`, and `create_event` tools.

### Namespacing

Organize tools under clear prefixes (e.g., `asana_search`, `asana_projects_search`) to help agents distinguish between similar functions and reduce decision-making errors.

### Returning Meaningful Context

Prioritize semantic information over technical identifiers. Replace UUIDs with readable names; offer a `response_format` parameter allowing agents to choose between "concise" (72 tokens) and "detailed" (206 tokens) responses to optimize context usage.

### Token Efficiency

Implement pagination, filtering, and truncation with helpful default values. The article provides examples of truncated tool responses with instructive guidance for agents rather than opaque error codes.

### Prompt Engineering

Tool descriptions significantly impact performance. The guidance suggests describing tools as you would to new team members, making implicit context explicit and avoiding ambiguous parameter names.

## Results

The authors demonstrate measurable improvements through their methodology. Internal evaluations of Slack and Asana tools show performance gains when optimized by Claude compared to human-written versions.

## Conclusion

Effective tool design requires shifting from traditional deterministic software patterns to approaches that account for agent variability. Through systematic evaluation and iteration—particularly leveraging agents themselves for analysis—developers can create tools that enable agents to intuitively solve real-world tasks.
