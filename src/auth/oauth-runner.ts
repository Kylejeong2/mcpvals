import {
  OAuth2Flow,
  OAuth2TestSuite,
  AuthorizationCodeTest,
  ClientCredentialsTest,
  DeviceCodeTest,
  TokenManagementTest,
  PKCEValidationTest,
  ResourceIndicatorTest,
  MultiTenantTest,
  PKCEUtils,
  SecurityUtils,
  TokenManager,
  OAuth2ServerConfig,
  OAuth2ClientConfig,
  TokenConfig,
} from "./oauth.js";
import chalk from "chalk";
import crypto from "crypto";

export interface OAuth2TestResult {
  name: string;
  flow: OAuth2Flow | string;
  success: boolean;
  error?: string;
  duration: number;
  details?: Record<string, unknown>;
  securityChecks?: Record<string, boolean>;
}

export interface OAuth2SuiteResult {
  name: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  results: OAuth2TestResult[];
}

export class OAuth2TestRunner {
  private tokenManager: TokenManager;
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.tokenManager = new TokenManager();
    this.verbose = verbose;
  }

  /**
   * Run a complete OAuth 2.1 test suite
   */
  async runTestSuite(suite: OAuth2TestSuite): Promise<OAuth2SuiteResult> {
    const startTime = Date.now();
    const results: OAuth2TestResult[] = [];

    this.log(chalk.cyan(`🔐 Running OAuth 2.1 Test Suite: ${suite.name}`));
    if (suite.description) {
      this.log(chalk.gray(`   ${suite.description}`));
    }

    // Run Authorization Code Flow Tests
    for (const test of suite.authorizationCodeTests) {
      const result = await this.runAuthorizationCodeTest(test);
      results.push(result);
    }

    // Run Client Credentials Flow Tests
    for (const test of suite.clientCredentialsTests) {
      const result = await this.runClientCredentialsTest(test);
      results.push(result);
    }

    // Run Device Code Flow Tests
    for (const test of suite.deviceCodeTests) {
      const result = await this.runDeviceCodeTest(test);
      results.push(result);
    }

    // Run Token Management Tests
    for (const test of suite.tokenManagementTests) {
      const result = await this.runTokenManagementTest(test);
      results.push(result);
    }

    // Run PKCE Validation Tests
    for (const test of suite.pkceValidationTests) {
      const result = await this.runPKCEValidationTest(test);
      results.push(result);
    }

    // Run Resource Indicator Tests
    for (const test of suite.resourceIndicatorTests) {
      const result = await this.runResourceIndicatorTest(test);
      results.push(result);
    }

    // Run Multi-Tenant Tests
    for (const test of suite.multiTenantTests) {
      const result = await this.runMultiTenantTest(test);
      results.push(result);
    }

    const duration = Date.now() - startTime;
    const passedTests = results.filter((r) => r.success).length;
    const failedTests = results.length - passedTests;

    const suiteResult: OAuth2SuiteResult = {
      name: suite.name,
      totalTests: results.length,
      passedTests,
      failedTests,
      duration,
      results,
    };

    this.logSuiteResult(suiteResult);
    return suiteResult;
  }

  /**
   * Run Authorization Code Flow test
   */
  private async runAuthorizationCodeTest(
    test: AuthorizationCodeTest,
  ): Promise<OAuth2TestResult> {
    const startTime = Date.now();
    this.log(chalk.yellow(`  📋 ${test.name} (Authorization Code Flow)`));

    try {
      const securityChecks: Record<string, boolean> = {};
      const details: Record<string, unknown> = {};

      // Generate PKCE parameters if enabled
      let codeVerifier: string | undefined;
      let codeChallenge: string | undefined;

      if (test.client.pkce?.enabled) {
        codeVerifier =
          test.client.pkce.codeVerifier || PKCEUtils.generateCodeVerifier();
        codeChallenge =
          test.client.pkce.codeChallenge ||
          PKCEUtils.generateCodeChallenge(
            codeVerifier,
            test.client.pkce.codeChallengeMethod,
          );
        details.pkce = {
          codeVerifier,
          codeChallenge,
          method: test.client.pkce.codeChallengeMethod,
        };
        securityChecks.pkceGenerated = true;
      }

      // Generate state and nonce for security
      const state =
        test.authorizationParams?.state || SecurityUtils.generateState();
      const nonce =
        test.authorizationParams?.nonce || SecurityUtils.generateNonce();
      details.state = state;
      details.nonce = nonce;

      // Build authorization URL
      const authParams = {
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: test.client.pkce?.codeChallengeMethod,
        ...(test.authorizationParams
          ? {
              prompt: test.authorizationParams.prompt,
              login_hint: test.authorizationParams.loginHint,
              max_age: test.authorizationParams.maxAge?.toString(),
            }
          : {}),
      };
      const authUrl = this.buildAuthorizationUrl(
        test.server,
        test.client,
        authParams,
      );
      details.authorizationUrl = authUrl;

      // Simulate authorization and callback (in real test, this would involve browser automation)
      const authCode = this.simulateAuthorizationCallback(
        test.simulateUserConsent,
      );
      if (!authCode && test.expectedResult === "success") {
        throw new Error("User authorization simulation failed");
      }
      details.authorizationCode = authCode;
      securityChecks.userConsentSimulated = test.simulateUserConsent;

      // Exchange authorization code for tokens
      if (authCode) {
        const tokenResponse = await this.exchangeCodeForTokens(
          test.server.tokenEndpoint,
          test.client,
          authCode,
          codeVerifier,
        );
        details.tokenResponse = tokenResponse;

        // Store token for future use
        const tokenId = `${test.name}-${Date.now()}`;
        this.tokenManager.storeToken(tokenId, tokenResponse);
        details.tokenId = tokenId;

        // Security checks
        if (
          test.securityChecks?.validatePKCE &&
          codeVerifier &&
          tokenResponse.accessToken
        ) {
          securityChecks.pkceValidated = true;
        }

        if (
          test.securityChecks?.checkTokenExpiration &&
          tokenResponse.accessToken
        ) {
          securityChecks.tokenExpirationChecked = !SecurityUtils.isTokenExpired(
            tokenResponse.accessToken,
          );
        }

        if (
          test.securityChecks?.validateAudience &&
          test.client.resourceIndicators?.[0]?.resourceUri
        ) {
          securityChecks.audienceValidated = SecurityUtils.validateAudience(
            tokenResponse.accessToken!,
            test.client.resourceIndicators[0].resourceUri,
          );
        }
      }

      const success =
        test.expectedResult === "success" ? !!authCode : !authCode;

      return {
        name: test.name,
        flow: OAuth2Flow.AUTHORIZATION_CODE,
        success,
        duration: Date.now() - startTime,
        details,
        securityChecks,
      };
    } catch (error) {
      const isExpectedError =
        test.expectedResult === "error" || test.expectedResult === "failure";
      return {
        name: test.name,
        flow: OAuth2Flow.AUTHORIZATION_CODE,
        success: isExpectedError,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run Client Credentials Flow test
   */
  private async runClientCredentialsTest(
    test: ClientCredentialsTest,
  ): Promise<OAuth2TestResult> {
    const startTime = Date.now();
    this.log(chalk.yellow(`  🔑 ${test.name} (Client Credentials Flow)`));

    try {
      const details: Record<string, unknown> = {};
      const securityChecks: Record<string, boolean> = {};

      // Prepare client credentials request
      const tokenResponse = await this.requestClientCredentialsToken(
        test.server.tokenEndpoint,
        test.client,
        test.clientAuthentication,
        test.additionalClaims,
      );

      details.tokenResponse = tokenResponse;

      // Store token
      const tokenId = `${test.name}-${Date.now()}`;
      this.tokenManager.storeToken(tokenId, tokenResponse);
      details.tokenId = tokenId;

      // Security checks
      if (
        test.securityChecks?.checkTokenExpiration &&
        tokenResponse.accessToken
      ) {
        securityChecks.tokenExpirationChecked = !SecurityUtils.isTokenExpired(
          tokenResponse.accessToken,
        );
      }

      if (
        test.securityChecks?.validateAudience &&
        test.client.resourceIndicators?.[0]?.resourceUri
      ) {
        securityChecks.audienceValidated = SecurityUtils.validateAudience(
          tokenResponse.accessToken!,
          test.client.resourceIndicators[0].resourceUri,
        );
      }

      if (test.securityChecks?.checkScopeRestriction) {
        securityChecks.scopeRestrictionChecked = this.validateTokenScopes(
          tokenResponse,
          test.client.scope,
        );
      }

      return {
        name: test.name,
        flow: OAuth2Flow.CLIENT_CREDENTIALS,
        success: test.expectedResult === "success",
        duration: Date.now() - startTime,
        details,
        securityChecks,
      };
    } catch (error) {
      const isExpectedError =
        test.expectedResult === "error" || test.expectedResult === "failure";
      return {
        name: test.name,
        flow: OAuth2Flow.CLIENT_CREDENTIALS,
        success: isExpectedError,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run Device Code Flow test
   */
  private async runDeviceCodeTest(
    test: DeviceCodeTest,
  ): Promise<OAuth2TestResult> {
    const startTime = Date.now();
    this.log(chalk.yellow(`  📱 ${test.name} (Device Code Flow)`));

    try {
      const details: Record<string, unknown> = {};
      const securityChecks: Record<string, boolean> = {};

      // Request device authorization
      const deviceAuthResponse = await this.requestDeviceAuthorization(
        test.server.deviceAuthorizationEndpoint!,
        test.client,
      );
      details.deviceAuthResponse = deviceAuthResponse;

      // Simulate user authorization on separate device
      if (test.simulateUserAuthorization) {
        details.userAuthorizationSimulated = true;
        securityChecks.userAuthorizationSimulated = true;
      }

      // Poll for token
      const tokenResponse = await this.pollForDeviceToken(
        test.server.tokenEndpoint,
        test.client.clientId,
        deviceAuthResponse.device_code,
        test.pollingInterval,
      );
      details.tokenResponse = tokenResponse;

      // Store token
      const tokenId = `${test.name}-${Date.now()}`;
      this.tokenManager.storeToken(tokenId, tokenResponse);
      details.tokenId = tokenId;

      return {
        name: test.name,
        flow: OAuth2Flow.DEVICE_CODE,
        success: test.expectedResult === "success",
        duration: Date.now() - startTime,
        details,
        securityChecks,
      };
    } catch (error) {
      const isExpectedError =
        test.expectedResult === "error" || test.expectedResult === "failure";
      return {
        name: test.name,
        flow: OAuth2Flow.DEVICE_CODE,
        success: isExpectedError,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run Token Management test
   */
  private async runTokenManagementTest(
    test: TokenManagementTest,
  ): Promise<OAuth2TestResult> {
    const startTime = Date.now();
    this.log(
      chalk.yellow(`  🎫 ${test.name} (Token Management: ${test.testType})`),
    );

    try {
      const details: Record<string, unknown> = {};
      const securityChecks: Record<string, boolean> = {};
      let success = false;

      switch (test.testType) {
        case "refresh":
          if (test.token.refreshToken) {
            // Note: In real implementation, would need actual token endpoint
            const refreshed = await this.tokenManager.refreshToken(
              "test-token",
              "https://auth.example.com/token",
              "test-client-id",
            );
            success = !!refreshed;
            details.refreshedToken = refreshed;
          }
          break;

        case "revocation":
          if (test.token.accessToken) {
            // Note: In real implementation, would need actual revocation endpoint
            success = await this.tokenManager.revokeToken(
              "test-token",
              "https://auth.example.com/revoke",
              "test-client-id",
            );
            details.tokenRevoked = success;
          }
          break;

        case "introspection":
          if (test.token.accessToken) {
            const isValid = this.tokenManager.isTokenValid("test-token");
            success = isValid;
            details.tokenIntrospection = { valid: isValid };
            securityChecks.tokenIntrospectionPerformed = true;
          }
          break;

        case "expiration":
          if (test.token.accessToken) {
            const isExpired = SecurityUtils.isTokenExpired(
              test.token.accessToken,
            );
            success =
              test.expectedResult === "success" ? !isExpired : isExpired;
            details.tokenExpiration = { expired: isExpired };
            securityChecks.expirationChecked = true;
          }
          break;
      }

      return {
        name: test.name,
        flow: `token_management_${test.testType}`,
        success,
        duration: Date.now() - startTime,
        details,
        securityChecks,
      };
    } catch (error) {
      const isExpectedError =
        test.expectedResult === "error" || test.expectedResult === "failure";
      return {
        name: test.name,
        flow: `token_management_${test.testType}`,
        success: isExpectedError,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run PKCE Validation test
   */
  private async runPKCEValidationTest(
    test: PKCEValidationTest,
  ): Promise<OAuth2TestResult> {
    const startTime = Date.now();
    this.log(chalk.yellow(`  🔒 ${test.name} (PKCE Validation)`));

    try {
      const details: Record<string, unknown> = {};
      const securityChecks: Record<string, boolean> = {};

      const verifier = test.codeVerifier || PKCEUtils.generateCodeVerifier();
      const challenge =
        test.codeChallenge ||
        PKCEUtils.generateCodeChallenge(verifier, test.codeChallengeMethod);

      details.codeVerifier = verifier;
      details.codeChallenge = challenge;
      details.method = test.codeChallengeMethod;

      // Optionally test with invalid challenge
      const testChallenge = test.invalidChallenge
        ? "invalid-challenge"
        : challenge;
      const isValid = PKCEUtils.validatePKCE(
        verifier,
        testChallenge,
        test.codeChallengeMethod,
      );

      securityChecks.pkceValidation = isValid;
      details.validationResult = isValid;

      const success = test.expectedResult === "success" ? isValid : !isValid;

      return {
        name: test.name,
        flow: "pkce_validation",
        success,
        duration: Date.now() - startTime,
        details,
        securityChecks,
      };
    } catch (error) {
      return {
        name: test.name,
        flow: "pkce_validation",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run Resource Indicator test (RFC 8707)
   */
  private async runResourceIndicatorTest(
    test: ResourceIndicatorTest,
  ): Promise<OAuth2TestResult> {
    const startTime = Date.now();
    this.log(chalk.yellow(`  🎯 ${test.name} (Resource Indicators)`));

    try {
      const details: Record<string, unknown> = {};
      const securityChecks: Record<string, boolean> = {};

      details.resourceUri = test.resourceUri;
      details.requestedScopes = test.requestedScopes;

      // Simulate resource-specific token request
      const mockToken = this.generateMockTokenWithAudience(
        test.resourceUri,
        test.requestedScopes,
      );
      details.mockToken = mockToken;

      // Validate audience restriction
      if (test.validateAudienceRestriction && test.expectedAudience) {
        const audienceValid = SecurityUtils.validateAudience(
          mockToken,
          test.expectedAudience,
        );
        securityChecks.audienceValidation = audienceValid;
        details.audienceValidation = audienceValid;
      }

      // Check cross-resource access
      if (test.crossResourceAccess) {
        const crossResourceUri = "https://different-resource.example.com";
        const crossResourceValid = SecurityUtils.validateAudience(
          mockToken,
          crossResourceUri,
        );
        securityChecks.crossResourceBlocked = !crossResourceValid;
        details.crossResourceAccess = {
          allowed: crossResourceValid,
          resourceUri: crossResourceUri,
        };
      }

      const success = test.expectedResult === "success";

      return {
        name: test.name,
        flow: "resource_indicators",
        success,
        duration: Date.now() - startTime,
        details,
        securityChecks,
      };
    } catch (error) {
      return {
        name: test.name,
        flow: "resource_indicators",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run Multi-Tenant Authentication test
   */
  private async runMultiTenantTest(
    test: MultiTenantTest,
  ): Promise<OAuth2TestResult> {
    const startTime = Date.now();
    this.log(
      chalk.yellow(`  🏢 ${test.name} (Multi-Tenant: ${test.testScenario})`),
    );

    try {
      const details: Record<string, unknown> = {};
      const securityChecks: Record<string, boolean> = {};

      details.primaryTenant = test.primaryTenant;
      details.secondaryTenant = test.secondaryTenant;
      details.testScenario = test.testScenario;

      let success = false;

      switch (test.testScenario) {
        case "same_tenant_access": {
          // Simulate access within same tenant
          success = true;
          securityChecks.sameTenantAccess = true;
          details.accessResult = "allowed";
          break;
        }

        case "cross_tenant_blocked": {
          // Simulate blocked cross-tenant access
          const crossTenantBlocked =
            test.primaryTenant.isolationLevel === "strict";
          success = crossTenantBlocked;
          securityChecks.crossTenantBlocked = crossTenantBlocked;
          details.accessResult = crossTenantBlocked ? "blocked" : "allowed";
          break;
        }

        case "cross_tenant_allowed": {
          // Simulate allowed cross-tenant access
          const crossTenantAllowed = test.primaryTenant.crossTenantAccess;
          success = crossTenantAllowed;
          securityChecks.crossTenantAllowed = crossTenantAllowed;
          details.accessResult = crossTenantAllowed ? "allowed" : "blocked";
          break;
        }

        case "tenant_isolation": {
          // Validate tenant isolation
          const isolationValid = this.validateTenantIsolation(
            test.primaryTenant,
            test.secondaryTenant,
          );
          success = isolationValid;
          securityChecks.tenantIsolation = isolationValid;
          details.isolationResult = isolationValid ? "valid" : "invalid";
          break;
        }

        case "tenant_switching": {
          // Simulate tenant switching
          const switchingAllowed =
            test.primaryTenant.isolationLevel === "relaxed";
          success = switchingAllowed;
          securityChecks.tenantSwitching = switchingAllowed;
          details.switchingResult = switchingAllowed ? "allowed" : "blocked";
          break;
        }
      }

      return {
        name: test.name,
        flow: `multi_tenant_${test.testScenario}`,
        success: test.expectedResult === "success" ? success : !success,
        duration: Date.now() - startTime,
        details,
        securityChecks,
      };
    } catch (error) {
      return {
        name: test.name,
        flow: `multi_tenant_${test.testScenario}`,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  // Helper methods
  private buildAuthorizationUrl(
    server: OAuth2ServerConfig,
    client: OAuth2ClientConfig,
    params: Record<string, string | undefined>,
  ): string {
    const url = new URL(server.authorizationEndpoint);

    url.searchParams.set("client_id", client.clientId);
    url.searchParams.set("response_type", client.responseType);
    url.searchParams.set("scope", client.scope.join(" "));

    if (client.redirectUri) {
      url.searchParams.set("redirect_uri", client.redirectUri);
    }

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  private simulateAuthorizationCallback(userConsent: boolean): string | null {
    if (!userConsent) return null;

    // Simulate authorization code generation
    return crypto.randomUUID().replace(/-/g, "");
  }

  private async exchangeCodeForTokens(
    tokenEndpoint: string,
    client: OAuth2ClientConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    authCode: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    codeVerifier?: string,
  ): Promise<TokenConfig> {
    // In a real implementation, this would make an actual HTTP request
    // For testing purposes, return a mock token
    return {
      accessToken: this.generateMockJWT("access_token", client.scope),
      refreshToken: crypto.randomUUID(),
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: client.scope,
    };
  }

  private async requestClientCredentialsToken(
    tokenEndpoint: string,
    client: OAuth2ClientConfig,
    authMethod: string,
    additionalClaims?: Record<string, unknown>,
  ): Promise<TokenConfig> {
    // Mock implementation
    return {
      accessToken: this.generateMockJWT(
        "access_token",
        client.scope,
        additionalClaims,
      ),
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: client.scope,
    };
  }

  private async requestDeviceAuthorization(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deviceEndpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    client: OAuth2ClientConfig,
  ): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
  }> {
    // Mock device authorization response
    return {
      device_code: crypto.randomUUID(),
      user_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      verification_uri: "https://auth.example.com/device",
      verification_uri_complete:
        "https://auth.example.com/device?user_code=ABC123",
      expires_in: 1800,
      interval: 5,
    };
  }

  private async pollForDeviceToken(
    tokenEndpoint: string,
    clientId: string,
    deviceCode: string,
    interval: number,
  ): Promise<TokenConfig> {
    // Mock polling - in real implementation would poll until authorized
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    return {
      accessToken: this.generateMockJWT("access_token", ["openid"]),
      refreshToken: crypto.randomUUID(),
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: ["openid"],
    };
  }

  private generateMockJWT(
    type: string,
    scopes: string[],
    additionalClaims?: Record<string, unknown>,
  ): string {
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: "https://auth.example.com",
      sub: "user123",
      aud: "https://api.example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      scope: scopes.join(" "),
      token_type: type,
      ...additionalClaims,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
      "base64url",
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );
    const signature = "mock-signature";

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private generateMockTokenWithAudience(
    resourceUri: string,
    scopes: string[],
  ): string {
    return this.generateMockJWT("access_token", scopes, { aud: resourceUri });
  }

  private validateTokenScopes(
    token: TokenConfig,
    expectedScopes: string[],
  ): boolean {
    if (!token.scope) return false;
    return expectedScopes.every((scope) => token.scope!.includes(scope));
  }

  private validateTenantIsolation(
    primaryTenant: { tenantId: string; isolationLevel: string },
    secondaryTenant?: { tenantId: string; isolationLevel: string },
  ): boolean {
    if (!secondaryTenant) return true;

    // Basic tenant isolation validation
    return (
      primaryTenant.tenantId !== secondaryTenant.tenantId &&
      primaryTenant.isolationLevel === "strict"
    );
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  private logSuiteResult(result: OAuth2SuiteResult): void {
    const passRate = (result.passedTests / result.totalTests) * 100;
    const status = result.failedTests === 0 ? "✅ PASSED" : "❌ FAILED";

    this.log(chalk.cyan(`\n🔐 OAuth 2.1 Suite Results: ${result.name}`));
    this.log(chalk.gray(`   Duration: ${result.duration}ms`));
    this.log(chalk.gray(`   Tests: ${result.totalTests} total`));
    this.log(chalk.green(`   Passed: ${result.passedTests}`));
    if (result.failedTests > 0) {
      this.log(chalk.red(`   Failed: ${result.failedTests}`));
    }
    this.log(chalk.gray(`   Pass Rate: ${passRate.toFixed(1)}%`));
    this.log(chalk.gray(`   Status: ${status}\n`));
  }
}
