import { loadConfig, Config } from './config.js';
import { ServerRunner } from './runner.js';
import { TraceStore } from './trace.js';
import { DeterministicEvaluator, WorkflowEvaluation } from './deterministic.js';
import { ConsoleReporter } from './reporters/console.js';

export interface EvaluateOptions {
  debug?: boolean;
  reporter?: 'console' | 'json' | 'junit';
  llmJudge?: boolean;
}

export interface EvaluationReport {
  config: Config;
  evaluations: WorkflowEvaluation[];
  passed: boolean;
  timestamp: Date;
}

/**
 * Main evaluation function
 */
export async function evaluate(
  configPath: string, 
  options: EvaluateOptions = {}
): Promise<EvaluationReport> {
  // Load configuration
  const config = await loadConfig(configPath);
  
  // Create trace store
  const traceStore = new TraceStore();
  
  // Create server runner
  const runner = new ServerRunner(config.server, traceStore, {
    timeout: config.timeout,
    debug: options.debug,
  });

  // Results collection
  const evaluations: WorkflowEvaluation[] = [];
  
  try {
    // Start the server
    console.log('Starting MCP server...');
    await runner.start();
    
    // List available tools
    const tools = await runner.listTools();
    console.log(`Available tools: ${tools.map(t => t.name).join(', ')}`);
    
    // Run each workflow
    for (const workflow of config.workflows) {
      console.log(`\nRunning workflow: ${workflow.name}`);
      
      // Clear trace store for this workflow
      traceStore.clear();
      
      // Execute workflow steps
      for (const step of workflow.steps) {
        // Simulate user message
        traceStore.addMessage({
          role: 'user',
          content: step.user,
          timestamp: new Date(),
        });
        
        // If we have expected tools, call them
        if (step.expectTools) {
          for (const toolName of step.expectTools) {
            try {
              // Find the tool to get its input schema
              const tool = tools.find(t => t.name === toolName);
              if (!tool) {
                console.warn(`Expected tool '${toolName}' not found`);
                continue;
              }
              
              // For demo purposes, use empty arguments
              // In a real scenario, you'd parse arguments from the user message
              const args = {};
              
              console.log(`Calling tool: ${toolName}`);
              const result = await runner.callTool(toolName, args);
              
              // Simulate assistant response with tool result
              traceStore.addMessage({
                role: 'assistant',
                content: JSON.stringify(result),
                toolCalls: [{
                  id: `call_${Date.now()}`,
                  name: toolName,
                  arguments: args,
                  timestamp: new Date(),
                }],
                timestamp: new Date(),
              });
            } catch (error) {
              console.error(`Error calling tool ${toolName}:`, error);
            }
          }
        }
      }
      
      // Evaluate the workflow
      const evaluator = new DeterministicEvaluator(traceStore);
      const evaluation = evaluator.evaluateWorkflow(workflow);
      evaluations.push(evaluation);
      
      // Optional: LLM Judge evaluation
      if (options.llmJudge && config.llmJudge && config.openaiKey) {
        // TODO: Implement LLM judge
        console.log('LLM Judge evaluation not yet implemented');
      }
    }
    
  } finally {
    // Stop the server
    await runner.stop();
  }
  
  // Generate report
  const report: EvaluationReport = {
    config,
    evaluations,
    passed: evaluations.every(e => e.passed),
    timestamp: new Date(),
  };
  
  // Output results
  switch (options.reporter || 'console') {
    case 'console':
      const consoleReporter = new ConsoleReporter();
      consoleReporter.report(evaluations);
      break;
    case 'json':
      console.log(JSON.stringify(report, null, 2));
      break;
    case 'junit':
      console.log('JUnit reporter not yet implemented');
      break;
  }
  
  return report;
}

// Re-export types
export { Config, Workflow, WorkflowStep } from './config.js';
export { WorkflowEvaluation, EvaluationResult } from './deterministic.js'; 