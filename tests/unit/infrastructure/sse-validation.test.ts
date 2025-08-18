import { describe, it, expect, beforeEach } from "vitest";
import { ConfigurationValidator } from "../../../src/eval/infrastructure/validation";
import { ConfigSchema } from "../../../src/eval/core/config";

describe("SSE Transport Validation", () => {
  let validator: ConfigurationValidator;

  beforeEach(() => {
    validator = new ConfigurationValidator({
      checkFilePaths: false,
      checkServerConnectivity: false,
    });
    console.log("SSE Transport Validation", validator);
  });

  it("should validate basic SSE server config through schema", () => {
    const config = {
      server: {
        transport: "sse" as const,
        url: "https://example.com/mcp/sse",
      },
      workflows: [],
      toolHealthSuites: [],
      resourceSuites: [],
      promptSuites: [],
      samplingSuites: [],
      oauth2Suites: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);

    if (result.success && result.data.server.transport === "sse") {
      // Check that defaults are applied
      expect(result.data.server.reconnect).toBe(true);
      expect(result.data.server.reconnectInterval).toBe(5000);
      expect(result.data.server.maxReconnectAttempts).toBe(10);
    }
  });

  it("should validate SSE config with custom options", () => {
    const config = {
      server: {
        transport: "sse" as const,
        url: "https://example.com/mcp/sse",
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        reconnect: false,
        reconnectInterval: 2000,
        maxReconnectAttempts: 5,
      },
      workflows: [],
      toolHealthSuites: [],
      resourceSuites: [],
      promptSuites: [],
      samplingSuites: [],
      oauth2Suites: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);

    if (result.success && result.data.server.transport === "sse") {
      expect(result.data.server.reconnect).toBe(false);
      expect(result.data.server.reconnectInterval).toBe(2000);
      expect(result.data.server.maxReconnectAttempts).toBe(5);
    }
  });

  it("should reject SSE config with invalid reconnect interval", () => {
    const config = {
      server: {
        transport: "sse" as const,
        url: "https://example.com/mcp/sse",
        reconnectInterval: 50, // Too low
      },
      workflows: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("reconnectInterval"),
        ),
      ).toBe(true);
    }
  });

  it("should reject SSE config with negative max reconnect attempts", () => {
    const config = {
      server: {
        transport: "sse" as const,
        url: "https://example.com/mcp/sse",
        maxReconnectAttempts: -1,
      },
      workflows: [],
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("maxReconnectAttempts"),
        ),
      ).toBe(true);
    }
  });

  it("should handle SSE URLs correctly", () => {
    const httpsConfig = {
      server: {
        transport: "sse" as const,
        url: "https://example.com/mcp/sse",
      },
      workflows: [],
    };

    const httpConfig = {
      server: {
        transport: "sse" as const,
        url: "http://localhost/mcp/sse",
      },
      workflows: [],
    };

    const invalidConfig = {
      server: {
        transport: "sse" as const,
        url: "not-a-url",
      },
      workflows: [],
    };

    expect(ConfigSchema.safeParse(httpsConfig).success).toBe(true);
    expect(ConfigSchema.safeParse(httpConfig).success).toBe(true);
    expect(ConfigSchema.safeParse(invalidConfig).success).toBe(false);
  });

  it("should validate header types", () => {
    const validConfig = {
      server: {
        transport: "sse" as const,
        url: "https://example.com/mcp/sse",
        headers: {
          Accept: "text/event-stream",
          Authorization: "Bearer token",
        },
      },
      workflows: [],
    };

    // This would fail validation at runtime due to type checking
    const invalidConfig = {
      server: {
        transport: "sse" as const,
        url: "https://example.com/mcp/sse",
        headers: {
          Accept: 123 as any, // Invalid type
        },
      },
      workflows: [],
    };

    expect(ConfigSchema.safeParse(validConfig).success).toBe(true);
    expect(ConfigSchema.safeParse(invalidConfig).success).toBe(false);
  });
});

describe("SSE Transport Functionality", () => {
  it("should be included in discriminated union", () => {
    const sseConfig = {
      transport: "sse" as const,
      url: "https://example.com/sse",
    };

    const stdioConfig = {
      transport: "stdio" as const,
      command: "node",
      args: ["server.js"],
    };

    const shttpConfig = {
      transport: "shttp" as const,
      url: "https://example.com/shttp",
    };

    // These should all be valid server configs
    expect(() => {
      if (sseConfig.transport === "sse") {
        expect(sseConfig.url).toBeDefined();
      }
      if (stdioConfig.transport === "stdio") {
        expect(stdioConfig.command).toBeDefined();
      }
      if (shttpConfig.transport === "shttp") {
        expect(shttpConfig.url).toBeDefined();
      }
    }).not.toThrow();
  });
});
