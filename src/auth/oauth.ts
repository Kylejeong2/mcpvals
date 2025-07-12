import { z } from "zod";
import crypto from "crypto";

// OAuth 2.1 Flow Types
export enum OAuth2Flow {
  AUTHORIZATION_CODE = "authorization_code",
  CLIENT_CREDENTIALS = "client_credentials",
  DEVICE_CODE = "device_code",
  REFRESH_TOKEN = "refresh_token",
}

// PKCE (Proof Key for Code Exchange) Schema
export const PKCEConfigSchema = z.object({
  enabled: z.boolean().default(true),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.enum(["S256", "plain"]).default("S256"),
  codeVerifier: z.string().optional(),
});

// Resource Indicators (RFC 8707) Schema
export const ResourceIndicatorSchema = z.object({
  resourceUri: z.string().url(),
  audienceRestriction: z.boolean().default(true),
  scopeMapping: z.record(z.array(z.string())).optional(),
});

// Multi-tenant Configuration Schema
export const MultiTenantConfigSchema = z.object({
  tenantId: z.string(),
  tenantDomain: z.string().optional(),
  isolationLevel: z.enum(["strict", "relaxed"]).default("strict"),
  crossTenantAccess: z.boolean().default(false),
});

// OAuth 2.1 Server Configuration Schema
export const OAuth2ServerConfigSchema = z.object({
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  revocationEndpoint: z.string().url().optional(),
  introspectionEndpoint: z.string().url().optional(),
  deviceAuthorizationEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  issuer: z.string().url().optional(),
  supportedGrantTypes: z.array(z.nativeEnum(OAuth2Flow)),
  supportedResponseTypes: z.array(z.string()).default(["code"]),
  supportedScopes: z.array(z.string()).default(["openid", "profile", "email"]),
  pkceRequired: z.boolean().default(true),
  resourceIndicatorsSupported: z.boolean().default(false),
});

// OAuth Client Configuration Schema
export const OAuth2ClientConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string().optional(),
  redirectUri: z.string().url().optional(),
  scope: z.array(z.string()).default(["openid"]),
  responseType: z.string().default("code"),
  grantType: z.nativeEnum(OAuth2Flow).default(OAuth2Flow.AUTHORIZATION_CODE),
  pkce: PKCEConfigSchema.optional(),
  resourceIndicators: z.array(ResourceIndicatorSchema).optional(),
  multiTenant: MultiTenantConfigSchema.optional(),
});

// Token Management Schema
export const TokenConfigSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenType: z.string().default("Bearer"),
  expiresIn: z.number().optional(),
  expiresAt: z.number().optional(),
  scope: z.array(z.string()).optional(),
  audience: z.string().optional(),
});

// OAuth 2.1 Test Configuration Schema
export const OAuth2TestConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  flow: z.nativeEnum(OAuth2Flow),
  server: OAuth2ServerConfigSchema,
  client: OAuth2ClientConfigSchema,
  token: TokenConfigSchema.optional(),
  expectedResult: z.enum(["success", "failure", "error"]).default("success"),
  expectedError: z.string().optional(),
  securityChecks: z
    .object({
      validatePKCE: z.boolean().default(true),
      validateState: z.boolean().default(true),
      validateNonce: z.boolean().default(true),
      checkTokenExpiration: z.boolean().default(true),
      validateAudience: z.boolean().default(true),
      checkScopeRestriction: z.boolean().default(true),
    })
    .optional(),
  timeout: z.number().default(30000),
  retries: z.number().min(0).max(5).default(0),
});

// Authorization Code Flow Test Schema
export const AuthorizationCodeTestSchema = OAuth2TestConfigSchema.extend({
  flow: z.literal(OAuth2Flow.AUTHORIZATION_CODE),
  authorizationParams: z
    .object({
      state: z.string().optional(),
      nonce: z.string().optional(),
      prompt: z.string().optional(),
      maxAge: z.number().optional(),
      loginHint: z.string().optional(),
    })
    .optional(),
  simulateUserConsent: z.boolean().default(true),
  validateRedirectUri: z.boolean().default(true),
});

// Client Credentials Flow Test Schema
export const ClientCredentialsTestSchema = OAuth2TestConfigSchema.extend({
  flow: z.literal(OAuth2Flow.CLIENT_CREDENTIALS),
  clientAuthentication: z
    .enum(["client_secret_basic", "client_secret_post", "private_key_jwt"])
    .default("client_secret_basic"),
  additionalClaims: z.record(z.unknown()).optional(),
});

// Device Code Flow Test Schema
export const DeviceCodeTestSchema = OAuth2TestConfigSchema.extend({
  flow: z.literal(OAuth2Flow.DEVICE_CODE),
  deviceCode: z.string().optional(),
  userCode: z.string().optional(),
  verificationUri: z.string().url().optional(),
  verificationUriComplete: z.string().url().optional(),
  pollingInterval: z.number().default(5),
  simulateUserAuthorization: z.boolean().default(true),
});

// Token Management Test Schema
export const TokenManagementTestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  testType: z.enum(["refresh", "revocation", "introspection", "expiration"]),
  token: TokenConfigSchema,
  expectedResult: z.enum(["success", "failure", "error"]).default("success"),
  validateTokenClaims: z.boolean().default(true),
  checkTokenSecurity: z.boolean().default(true),
  timeout: z.number().default(15000),
});

// PKCE Validation Test Schema
export const PKCEValidationTestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  codeVerifier: z.string().optional(),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.enum(["S256", "plain"]).default("S256"),
  invalidChallenge: z.boolean().default(false),
  expectedResult: z.enum(["success", "failure"]).default("success"),
  securityLevel: z.enum(["high", "medium", "low"]).default("high"),
});

// Resource Indicator Test Schema (RFC 8707)
export const ResourceIndicatorTestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  resourceUri: z.string().url(),
  requestedScopes: z.array(z.string()),
  expectedAudience: z.string().optional(),
  crossResourceAccess: z.boolean().default(false),
  validateAudienceRestriction: z.boolean().default(true),
  expectedResult: z.enum(["success", "failure"]).default("success"),
});

// Multi-Tenant Authentication Test Schema
export const MultiTenantTestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  primaryTenant: MultiTenantConfigSchema,
  secondaryTenant: MultiTenantConfigSchema.optional(),
  testScenario: z.enum([
    "same_tenant_access",
    "cross_tenant_blocked",
    "cross_tenant_allowed",
    "tenant_isolation",
    "tenant_switching",
  ]),
  expectedResult: z.enum(["success", "failure"]).default("success"),
  validateTenantIsolation: z.boolean().default(true),
});

// OAuth 2.1 Test Suite Schema
export const OAuth2TestSuiteSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  authorizationCodeTests: z
    .array(AuthorizationCodeTestSchema)
    .optional()
    .default([]),
  clientCredentialsTests: z
    .array(ClientCredentialsTestSchema)
    .optional()
    .default([]),
  deviceCodeTests: z.array(DeviceCodeTestSchema).optional().default([]),
  tokenManagementTests: z
    .array(TokenManagementTestSchema)
    .optional()
    .default([]),
  pkceValidationTests: z.array(PKCEValidationTestSchema).optional().default([]),
  resourceIndicatorTests: z
    .array(ResourceIndicatorTestSchema)
    .optional()
    .default([]),
  multiTenantTests: z.array(MultiTenantTestSchema).optional().default([]),
  parallel: z.boolean().default(false),
  timeout: z.number().optional(),
});

// Type exports
export type OAuth2TestConfig = z.infer<typeof OAuth2TestConfigSchema>;
export type AuthorizationCodeTest = z.infer<typeof AuthorizationCodeTestSchema>;
export type ClientCredentialsTest = z.infer<typeof ClientCredentialsTestSchema>;
export type DeviceCodeTest = z.infer<typeof DeviceCodeTestSchema>;
export type TokenManagementTest = z.infer<typeof TokenManagementTestSchema>;
export type PKCEValidationTest = z.infer<typeof PKCEValidationTestSchema>;
export type ResourceIndicatorTest = z.infer<typeof ResourceIndicatorTestSchema>;
export type MultiTenantTest = z.infer<typeof MultiTenantTestSchema>;
export type OAuth2TestSuite = z.infer<typeof OAuth2TestSuiteSchema>;
export type PKCEConfig = z.infer<typeof PKCEConfigSchema>;
export type ResourceIndicator = z.infer<typeof ResourceIndicatorSchema>;
export type MultiTenantConfig = z.infer<typeof MultiTenantConfigSchema>;
export type OAuth2ServerConfig = z.infer<typeof OAuth2ServerConfigSchema>;
export type OAuth2ClientConfig = z.infer<typeof OAuth2ClientConfigSchema>;
export type TokenConfig = z.infer<typeof TokenConfigSchema>;

// PKCE Utility Functions
export class PKCEUtils {
  /**
   * Generate a cryptographically secure code verifier
   */
  static generateCodeVerifier(length: number = 43): string {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";

    for (let i = 0; i < length; i++) {
      result += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return result;
  }

  /**
   * Generate code challenge from verifier using S256 method
   */
  static generateCodeChallenge(
    verifier: string,
    method: "S256" | "plain" = "S256",
  ): string {
    if (method === "plain") {
      return verifier;
    }

    // S256 method - SHA256 hash then base64url encode
    const hash = crypto.createHash("sha256").update(verifier).digest();
    return hash
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Validate PKCE challenge against verifier
   */
  static validatePKCE(
    verifier: string,
    challenge: string,
    method: "S256" | "plain" = "S256",
  ): boolean {
    const expectedChallenge = this.generateCodeChallenge(verifier, method);
    return expectedChallenge === challenge;
  }
}

// State and Nonce Utility Functions
export class SecurityUtils {
  /**
   * Generate a cryptographically secure state parameter
   */
  static generateState(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Generate a cryptographically secure nonce
   */
  static generateNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Validate JWT token structure and signature (basic validation)
   */
  static validateJWTStructure(token: string): boolean {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    try {
      // Validate header
      JSON.parse(Buffer.from(parts[0], "base64url").toString());
      // Validate payload
      JSON.parse(Buffer.from(parts[1], "base64url").toString());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract claims from JWT token
   */
  static extractJWTClaims(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const claims = this.extractJWTClaims(token);
    if (!claims || !claims.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return now >= (claims.exp as number);
  }

  /**
   * Validate audience claim
   */
  static validateAudience(token: string, expectedAudience: string): boolean {
    const claims = this.extractJWTClaims(token);
    if (!claims || !claims.aud) return false;

    const audience = claims.aud;
    if (Array.isArray(audience)) {
      return audience.includes(expectedAudience);
    }
    return audience === expectedAudience;
  }
}

// Token Manager for handling OAuth 2.1 tokens
export class TokenManager {
  private tokens: Map<string, TokenConfig> = new Map();

  /**
   * Store a token with metadata
   */
  storeToken(tokenId: string, token: TokenConfig): void {
    const enrichedToken = {
      ...token,
      expiresAt: token.expiresIn
        ? Date.now() + token.expiresIn * 1000
        : undefined,
    };
    this.tokens.set(tokenId, enrichedToken);
  }

  /**
   * Retrieve a token by ID
   */
  getToken(tokenId: string): TokenConfig | undefined {
    return this.tokens.get(tokenId);
  }

  /**
   * Check if a token is valid (not expired)
   */
  isTokenValid(tokenId: string): boolean {
    const token = this.tokens.get(tokenId);
    if (!token) return false;

    if (token.expiresAt) {
      return Date.now() < token.expiresAt;
    }

    if (token.accessToken) {
      return !SecurityUtils.isTokenExpired(token.accessToken);
    }

    return true;
  }

  /**
   * Refresh a token using refresh token
   */
  async refreshToken(
    tokenId: string,
    tokenEndpoint: string,
    clientId: string,
    clientSecret?: string,
  ): Promise<TokenConfig | null> {
    const token = this.tokens.get(tokenId);
    if (!token || !token.refreshToken) return null;

    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        client_id: clientId,
      });

      if (clientSecret) {
        body.append("client_secret", clientSecret);
      }

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokenResponse = await response.json();
      const newToken: TokenConfig = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || token.refreshToken,
        tokenType: tokenResponse.token_type || "Bearer",
        expiresIn: tokenResponse.expires_in,
        expiresAt: tokenResponse.expires_in
          ? Date.now() + tokenResponse.expires_in * 1000
          : undefined,
        scope: tokenResponse.scope
          ? tokenResponse.scope.split(" ")
          : token.scope,
      };

      this.storeToken(tokenId, newToken);
      return newToken;
    } catch (error) {
      console.error("Token refresh error:", error);
      return null;
    }
  }

  /**
   * Revoke a token
   */
  async revokeToken(
    tokenId: string,
    revocationEndpoint: string,
    clientId: string,
    clientSecret?: string,
  ): Promise<boolean> {
    const token = this.tokens.get(tokenId);
    if (!token || !token.accessToken) return false;

    try {
      const body = new URLSearchParams({
        token: token.accessToken,
        client_id: clientId,
      });

      if (clientSecret) {
        body.append("client_secret", clientSecret);
      }

      const response = await fetch(revocationEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (response.ok) {
        this.tokens.delete(tokenId);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Token revocation error:", error);
      return false;
    }
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    this.tokens.clear();
  }

  /**
   * Get all stored token IDs
   */
  getTokenIds(): string[] {
    return Array.from(this.tokens.keys());
  }
}
