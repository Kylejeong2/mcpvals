# Core Concepts

MCPVals provides comprehensive testing for all MCP specification primitives:

1.  **Tool Health Testing**: Directly calls individual tools with specific arguments to verify their correctness, performance, and error handling. This is ideal for unit testing and regression checking.

2.  **Resource Evaluation**: Tests MCP resources (data and context) including discovery, access validation, URI template testing, content validation, and subscription capabilities.

3.  **Prompt Evaluation**: Validates MCP prompts (templates and workflows) with argument testing, template generation, security validation, and dynamic content evaluation.

4.  **Sampling Evaluation**: Tests MCP sampling capabilities (server-initiated LLM requests) including capability negotiation, human-in-the-loop workflows, model preferences, and security controls.

5.  **Workflow Evaluation**: Uses a large language model (LLM) to interpret natural language prompts and execute a series of tool calls to achieve a goal. This tests the integration of your MCP primitives from an LLM's perspective.

6.  **OAuth 2.1 Testing**: Comprehensive OAuth 2.1 authentication flow testing with PKCE, resource indicators (RFC 8707), multi-tenant support, and security validation. Tests authorization code flows, client credentials, device flows, token management, and security controls.

---

A comprehensive evaluation library for Model Context Protocol (MCP) servers. Test and validate your MCP servers with complete MCP specification coverage including Tools, Resources, Prompts, and Sampling with deterministic metrics, security validation, and optional LLM-based evaluation.

> **Status**: MVP – API **stable**, minor breaking changes possible before 1.0.0
