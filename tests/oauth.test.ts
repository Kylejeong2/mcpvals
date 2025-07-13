import { describe, it, expect } from "vitest";
import {
  PKCEUtils,
  SecurityUtils,
  TokenManager,
  OAuth2TestSuiteSchema,
  AuthorizationCodeTestSchema,
  PKCEValidationTestSchema,
} from "../src/auth/oauth.js";

describe("OAuth 2.1 Authentication Testing", () => {
  describe("PKCE Utils", () => {
    it("should generate a valid code verifier", () => {
      const verifier = PKCEUtils.generateCodeVerifier();
      expect(verifier).toHaveLength(43);
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it("should generate S256 code challenge", () => {
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const challenge = PKCEUtils.generateCodeChallenge(verifier, "S256");
      expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    });

    it("should generate plain code challenge", () => {
      const verifier = "test-verifier";
      const challenge = PKCEUtils.generateCodeChallenge(verifier, "plain");
      expect(challenge).toBe(verifier);
    });

    it("should validate PKCE correctly", () => {
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

      expect(PKCEUtils.validatePKCE(verifier, challenge, "S256")).toBe(true);
      expect(
        PKCEUtils.validatePKCE(verifier, "invalid-challenge", "S256"),
      ).toBe(false);
    });
  });

  describe("Security Utils", () => {
    it("should generate secure state and nonce", () => {
      const state = SecurityUtils.generateState();
      const nonce = SecurityUtils.generateNonce();

      expect(state).toHaveLength(32);
      expect(nonce).toHaveLength(32);
      expect(state).toMatch(/^[a-f0-9]+$/);
      expect(nonce).toMatch(/^[a-f0-9]+$/);
    });

    it("should validate JWT structure", () => {
      const validJWT =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.mock-test-signature";
      const invalidJWT = "invalid.jwt.structure";

      expect(SecurityUtils.validateJWTStructure(validJWT)).toBe(true);
      expect(SecurityUtils.validateJWTStructure(invalidJWT)).toBe(false);
    });

    it("should extract JWT claims", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.mock-test-signature";
      const claims = SecurityUtils.extractJWTClaims(jwt);

      expect(claims).toEqual({
        sub: "1234567890",
        name: "John Doe",
        iat: 1516239022,
      });
    });

    it("should check token expiration", () => {
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNjAwMDAwMDAwfQ.example";
      const futureToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjo5OTk5OTk5OTk5fQ.example";

      expect(SecurityUtils.isTokenExpired(expiredToken)).toBe(true);
      expect(SecurityUtils.isTokenExpired(futureToken)).toBe(false);
    });

    it("should validate audience claims", () => {
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiYXVkIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20ifQ.example";

      expect(
        SecurityUtils.validateAudience(token, "https://api.example.com"),
      ).toBe(true);
      expect(
        SecurityUtils.validateAudience(token, "https://other.example.com"),
      ).toBe(false);
    });
  });

  describe("Token Manager", () => {
    it("should store and retrieve tokens", () => {
      const tokenManager = new TokenManager();
      const token = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresIn: 3600,
        scope: ["read", "write"],
      };

      tokenManager.storeToken("test-token", token);
      const retrieved = tokenManager.getToken("test-token");

      expect(retrieved).toEqual(expect.objectContaining(token));
      expect(retrieved?.expiresAt).toBeDefined();
    });

    it("should validate token validity", () => {
      const tokenManager = new TokenManager();
      const validToken = {
        accessToken: "access-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };
      const expiredToken = {
        accessToken: "expired-token",
        tokenType: "Bearer",
        expiresAt: Date.now() - 1000,
      };

      tokenManager.storeToken("valid", validToken);
      tokenManager.storeToken("expired", expiredToken);

      expect(tokenManager.isTokenValid("valid")).toBe(true);
      expect(tokenManager.isTokenValid("expired")).toBe(false);
      expect(tokenManager.isTokenValid("nonexistent")).toBe(false);
    });

    it("should clear all tokens", () => {
      const tokenManager = new TokenManager();
      tokenManager.storeToken("token1", {
        accessToken: "token1",
        tokenType: "Bearer",
      });
      tokenManager.storeToken("token2", {
        accessToken: "token2",
        tokenType: "Bearer",
      });

      expect(tokenManager.getTokenIds()).toHaveLength(2);

      tokenManager.clearTokens();
      expect(tokenManager.getTokenIds()).toHaveLength(0);
    });
  });

  describe("Schema Validation", () => {
    it("should validate OAuth2TestSuite schema", () => {
      const validSuite = {
        name: "Test Suite",
        description: "Test OAuth 2.1 flows",
        authorizationCodeTests: [],
        clientCredentialsTests: [],
        deviceCodeTests: [],
        tokenManagementTests: [],
        pkceValidationTests: [],
        resourceIndicatorTests: [],
        multiTenantTests: [],
        parallel: false,
      };

      expect(() => OAuth2TestSuiteSchema.parse(validSuite)).not.toThrow();
    });

    it("should validate AuthorizationCodeTest schema", () => {
      const validTest = {
        name: "Authorization Code Test",
        flow: "authorization_code" as const,
        server: {
          authorizationEndpoint: "https://auth.example.com/authorize",
          tokenEndpoint: "https://auth.example.com/token",
          supportedGrantTypes: ["authorization_code" as const],
          supportedScopes: ["read", "write"],
          pkceRequired: true,
        },
        client: {
          clientId: "test-client",
          responseType: "code",
          scope: ["read"],
          redirectUri: "https://app.example.com/callback",
        },
        simulateUserConsent: true,
        expectedResult: "success" as const,
      };

      expect(() => AuthorizationCodeTestSchema.parse(validTest)).not.toThrow();
    });

    it("should validate PKCEValidationTest schema", () => {
      const validTest = {
        name: "PKCE Test",
        codeChallengeMethod: "S256" as const,
        invalidChallenge: false,
        expectedResult: "success" as const,
        securityLevel: "high" as const,
      };

      expect(() => PKCEValidationTestSchema.parse(validTest)).not.toThrow();
    });
  });
});
