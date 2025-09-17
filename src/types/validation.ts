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
