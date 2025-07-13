import { Config, ServerConfig } from "./config.js";
import { existsSync } from "fs";
import { resolve } from "path";
import { isIP } from "net";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface StartupValidationOptions {
  checkFilePaths?: boolean;
  checkEnvironmentVariables?: boolean;
  checkServerConnectivity?: boolean;
  validateTestReferences?: boolean;
  strictMode?: boolean;
}

/**
 * Check if a hostname is localhost or on a private network
 */
function isLocalOrPrivate(hostname: string): boolean {
  // Check for localhost variations
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return true;
  }

  // Check for IPv4 private ranges
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    const parts = hostname.split(".").map(Number);
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  // Check for IPv6 private ranges (simplified)
  if (ipVersion === 6) {
    return (
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe80") ||
      hostname === "::1"
    );
  }

  // Check for development domains
  return (
    hostname.endsWith(".local") ||
    hostname.endsWith(".dev") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Validate server headers
 */
function validateHeaders(headers: Record<string, string>): {
  errors: string[];
  warnings: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== "string") {
      errors.push(`Header ${key} must be a string`);
    }
    if (key.toLowerCase() === "authorization" && value.startsWith("Bearer ")) {
      suggestions.push(
        "Consider using environment variables for authorization tokens",
      );
    }
  }

  return { errors, warnings, suggestions };
}

export class ConfigurationValidator {
  private options: Required<StartupValidationOptions>;

  constructor(options: StartupValidationOptions = {}) {
    this.options = {
      checkFilePaths: options.checkFilePaths ?? true,
      checkEnvironmentVariables: options.checkEnvironmentVariables ?? true,
      checkServerConnectivity: options.checkServerConnectivity ?? false,
      validateTestReferences: options.validateTestReferences ?? true,
      strictMode: options.strictMode ?? false,
    };
  }

  async validateConfig(config: Config): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate server configuration
    const serverValidation = this.validateServerConfig(config.server);
    errors.push(...serverValidation.errors);
    warnings.push(...serverValidation.warnings);
    suggestions.push(...serverValidation.suggestions);

    // Validate environment variables
    if (this.options.checkEnvironmentVariables) {
      const envValidation = this.validateEnvironmentVariables(config);
      errors.push(...envValidation.errors);
      warnings.push(...envValidation.warnings);
      suggestions.push(...envValidation.suggestions);
    }

    // Validate test suite configuration
    const testValidation = this.validateTestSuites(config);
    errors.push(...testValidation.errors);
    warnings.push(...testValidation.warnings);
    suggestions.push(...testValidation.suggestions);

    // Validate cross-references between test suites
    if (this.options.validateTestReferences) {
      const refValidation = this.validateTestReferences(config);
      errors.push(...refValidation.errors);
      warnings.push(...refValidation.warnings);
      suggestions.push(...refValidation.suggestions);
    }

    // Validate performance settings
    const perfValidation = this.validatePerformanceSettings(config);
    errors.push(...perfValidation.errors);
    warnings.push(...perfValidation.warnings);
    suggestions.push(...perfValidation.suggestions);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  private validateServerConfig(server: ServerConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (server.transport === "stdio") {
      // Validate command and arguments
      if (!server.command) {
        errors.push("Server command is required for stdio transport");
      } else if (this.options.checkFilePaths && server.command !== "node") {
        // Check if command exists (for non-node commands)
        if (!existsSync(server.command) && !this.isInPath(server.command)) {
          errors.push(`Server command not found: ${server.command}`);
        }
      }

      // Check for common argument patterns
      if (server.args && server.args.length > 0) {
        const scriptArg = server.args[0];
        if (scriptArg && this.options.checkFilePaths) {
          const resolvedPath = resolve(process.cwd(), scriptArg);
          if (!existsSync(resolvedPath) && !existsSync(scriptArg)) {
            warnings.push(`Script file may not exist: ${scriptArg}`);
          }
        }
      }

      // Environment variable validation
      if (server.env) {
        for (const [key, value] of Object.entries(server.env)) {
          if (typeof value !== "string") {
            errors.push(`Environment variable ${key} must be a string`);
          }
          if (key.includes(" ")) {
            warnings.push(`Environment variable name contains spaces: ${key}`);
          }
          if (value.includes("${") && !value.match(/\${[^}]+}/)) {
            warnings.push(
              `Malformed environment variable expansion in ${key}: ${value}`,
            );
          }
        }
      }
    } else if (server.transport === "shttp") {
      // Validate URL
      let url: URL;
      try {
        url = new URL(server.url);
      } catch {
        errors.push(`Invalid server URL: ${server.url}`);
        return { valid: errors.length === 0, errors, warnings, suggestions };
      }

      // Check URL security
      if (url.protocol === "http:" && !isLocalOrPrivate(url.hostname)) {
        warnings.push(
          "Using HTTP instead of HTTPS for remote server connections is not recommended",
        );
      }

      // Validate headers
      if (server.headers) {
        const headerValidation = validateHeaders(server.headers);
        errors.push(...headerValidation.errors);
        warnings.push(...headerValidation.warnings);
        suggestions.push(...headerValidation.suggestions);
      }
    } else if (server.transport === "sse") {
      // Validate URL
      let url: URL;
      try {
        url = new URL(server.url);
      } catch {
        errors.push(`Invalid server URL: ${server.url}`);
        return { valid: errors.length === 0, errors, warnings, suggestions };
      }

      // Check URL security
      if (url.protocol === "http:" && !isLocalOrPrivate(url.hostname)) {
        warnings.push(
          "Using HTTP instead of HTTPS for SSE connections is not recommended",
        );
      }

      // Validate headers
      if (server.headers) {
        const headerValidation = validateHeaders(server.headers);
        errors.push(...headerValidation.errors);
        warnings.push(...headerValidation.warnings);
        suggestions.push(...headerValidation.suggestions);
      }

      // Validate reconnection settings
      if (
        server.reconnectInterval !== undefined &&
        server.reconnectInterval < 100
      ) {
        warnings.push(
          "Reconnect interval should be at least 100ms to avoid excessive reconnection attempts",
        );
      }

      if (
        server.maxReconnectAttempts !== undefined &&
        server.maxReconnectAttempts > 50
      ) {
        warnings.push(
          "High number of reconnect attempts may cause excessive load on the server",
        );
      }

      // SSE-specific suggestions
      if (!server.headers || !server.headers["Accept"]) {
        suggestions.push(
          "Consider setting 'Accept: text/event-stream' header for SSE connections",
        );
      }

      if (!server.headers || !server.headers["Cache-Control"]) {
        suggestions.push(
          "Consider setting 'Cache-Control: no-cache' header for SSE connections",
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  private validateEnvironmentVariables(config: Config): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for required environment variables
    const requiredEnvVars = new Set<string>();

    // Check for Anthropic API key if LLM features are used
    if (config.workflows && config.workflows.length > 0) {
      requiredEnvVars.add("ANTHROPIC_API_KEY");
    }

    // Check if environment variables are set
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`Required environment variable not set: ${envVar}`);
      }
    }

    // Check for potentially dangerous environment variable patterns
    const allEnvVars = [
      ...Object.keys(
        config.server.transport === "stdio" ? config.server.env || {} : {},
      ),
    ];

    for (const envVar of allEnvVars) {
      if (
        envVar.toLowerCase().includes("password") ||
        envVar.toLowerCase().includes("secret")
      ) {
        suggestions.push(
          `Consider using secure secret management for sensitive variable: ${envVar}`,
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  private validateTestSuites(config: Config): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    let totalTests = 0;

    // Count total tests across all suites
    for (const suite of config.toolHealthSuites || []) {
      totalTests += suite.tests.length;
      if (suite.tests.length === 0) {
        warnings.push(`Tool health suite "${suite.name}" has no tests`);
      }
    }

    for (const suite of config.resourceSuites || []) {
      totalTests += (suite.resourceTests || []).length;
      totalTests += (suite.discoveryTests || []).length;
      totalTests += (suite.templateTests || []).length;
      totalTests += (suite.subscriptionTests || []).length;

      if (totalTests === 0) {
        warnings.push(`Resource suite "${suite.name}" has no tests`);
      }
    }

    for (const suite of config.promptSuites || []) {
      totalTests += (suite.promptTests || []).length;
      totalTests += (suite.discoveryTests || []).length;
      totalTests += (suite.argumentTests || []).length;
      totalTests += (suite.templateTests || []).length;
      totalTests += (suite.securityTests || []).length;

      if (totalTests === 0) {
        warnings.push(`Prompt suite "${suite.name}" has no tests`);
      }
    }

    for (const suite of config.samplingSuites || []) {
      totalTests += (suite.capabilityTests || []).length;
      totalTests += (suite.requestTests || []).length;
      totalTests += (suite.securityTests || []).length;
      totalTests += (suite.performanceTests || []).length;
      totalTests += (suite.contentTests || []).length;
      totalTests += (suite.workflowTests || []).length;

      if (totalTests === 0) {
        warnings.push(`Sampling suite "${suite.name}" has no tests`);
      }
    }

    totalTests += config.workflows?.length || 0;

    if (totalTests === 0) {
      warnings.push("No tests configured - configuration may be incomplete");
    } else if (totalTests > 10000) {
      warnings.push(
        `Large number of tests (${totalTests}) may impact performance`,
      );
      suggestions.push(
        "Consider breaking large test suites into smaller, focused suites",
      );
    }

    // Check for duplicate suite names
    const suiteNames = new Set<string>();
    const allSuites = [
      ...(config.toolHealthSuites || []).map((s) => s.name),
      ...(config.resourceSuites || []).map((s) => s.name),
      ...(config.promptSuites || []).map((s) => s.name),
      ...(config.samplingSuites || []).map((s) => s.name),
    ];

    for (const name of allSuites) {
      if (suiteNames.has(name)) {
        errors.push(`Duplicate suite name: ${name}`);
      }
      suiteNames.add(name);
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  private validateTestReferences(config: Config): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for test name duplicates within suites
    for (const suite of config.toolHealthSuites || []) {
      const testNames = new Set<string>();
      for (const test of suite.tests) {
        if (testNames.has(test.name)) {
          errors.push(
            `Duplicate test name in tool health suite "${suite.name}": ${test.name}`,
          );
        }
        testNames.add(test.name);
      }
    }

    // Similar validation for other suite types...
    for (const suite of config.promptSuites || []) {
      const testNames = new Set<string>();
      for (const test of suite.promptTests || []) {
        if (testNames.has(test.name)) {
          errors.push(
            `Duplicate test name in prompt suite "${suite.name}": ${test.name}`,
          );
        }
        testNames.add(test.name);
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  private validatePerformanceSettings(config: Config): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate timeout settings
    if (config.timeout && config.timeout < 1000) {
      warnings.push(
        `Very short global timeout (${config.timeout}ms) may cause test failures`,
      );
    }

    if (config.timeout && config.timeout > 300000) {
      warnings.push(
        `Very long global timeout (${config.timeout}ms) may mask performance issues`,
      );
    }

    // Check parallel execution settings
    const hasParallelSuites = [
      ...(config.toolHealthSuites || []),
      ...(config.resourceSuites || []),
      ...(config.promptSuites || []),
      ...(config.samplingSuites || []),
    ].some((suite) => suite.parallel);

    if (hasParallelSuites) {
      suggestions.push(
        "Parallel test execution is enabled - ensure your server can handle concurrent requests",
      );
    }

    // Validate pass threshold
    if (config.passThreshold < 0.5) {
      warnings.push(
        `Low pass threshold (${config.passThreshold}) may hide failing tests`,
      );
    }

    if (config.passThreshold > 0.95) {
      warnings.push(
        `Very high pass threshold (${config.passThreshold}) may be too strict`,
      );
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  private isInPath(command: string): boolean {
    const path = process.env.PATH || "";
    const pathSeparator = process.platform === "win32" ? ";" : ":";
    const extensions =
      process.platform === "win32" ? [".exe", ".cmd", ".bat"] : [""];

    for (const dir of path.split(pathSeparator)) {
      for (const ext of extensions) {
        if (existsSync(resolve(dir, command + ext))) {
          return true;
        }
      }
    }
    return false;
  }
}

export function createStartupValidator(
  options?: StartupValidationOptions,
): ConfigurationValidator {
  return new ConfigurationValidator(options);
}

export async function validateConfigurationAtStartup(
  config: Config,
  options?: StartupValidationOptions,
): Promise<ValidationResult> {
  const validator = createStartupValidator(options);
  return await validator.validateConfig(config);
}
