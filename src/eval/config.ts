import { z } from 'zod';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Workflow step schema
export const WorkflowStepSchema = z.object({
  user: z.string().describe('User message to send'),
  expectTools: z.array(z.string()).optional().describe('Expected tools to be called in order'),
  expectedState: z.string().optional().describe('Expected end state for LLM judge'),
});

// Workflow schema
export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema),
});

// Server configuration schema
export const ServerSchema = z.discriminatedUnion('transport', [
  z.object({
    transport: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string()).optional(),
  }),
  z.object({
    transport: z.literal('shttp'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  }),
]);

// Main configuration schema
export const ConfigSchema = z.object({
  server: ServerSchema,
  workflows: z.array(WorkflowSchema),
  llmJudge: z.boolean().default(false),
  openaiKey: z.string().optional(),
  timeout: z.number().optional().default(30000), // 30 seconds default
});

export type Config = z.infer<typeof ConfigSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type ServerConfig = z.infer<typeof ServerSchema>;

/**
 * Load and validate configuration from a file
 */
export async function loadConfig(configPath: string): Promise<Config> {
  const absolutePath = resolve(process.cwd(), configPath);
  
  try {
    // Handle both .json and .ts/.js files
    if (configPath.endsWith('.json')) {
      const content = await readFile(absolutePath, 'utf-8');
      const rawConfig = JSON.parse(content);
      return ConfigSchema.parse(rawConfig);
    } else {
      // Dynamic import for .ts/.js files
      const module = await import(absolutePath);
      const rawConfig = module.default || module;
      return ConfigSchema.parse(rawConfig);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
} 