import { Command } from 'commander';
import { evaluate } from '../eval/index.js';
import chalk from 'chalk';
import { resolve } from 'path';

export const evalCommand = new Command('eval')
  .description('Evaluate MCP servers against test workflows')
  .argument('<config>', 'Path to evaluation config file')
  .option('-d, --debug', 'Enable debug output', false)
  .option('-r, --reporter <type>', 'Output format (console, json, junit)', 'console')
  .option('--llm', 'Enable LLM judge evaluation', false)
  .action(async (configPath: string, options) => {
    try {
      const absolutePath = resolve(process.cwd(), configPath);
      
      console.log(chalk.blue('🔍 Starting MCP server evaluation...'));
      console.log(chalk.gray(`Config: ${absolutePath}`));
      console.log(chalk.gray(`Reporter: ${options.reporter}`));
      
      const report = await evaluate(absolutePath, {
        debug: options.debug,
        reporter: options.reporter,
        llmJudge: options.llm,
      });
      
      // Exit with appropriate code
      process.exit(report.passed ? 0 : 1);
    } catch (error) {
      console.error(chalk.red('❌ Evaluation failed:'), error);
      process.exit(1);
    }
  });

// List command to show available workflows
export const listCommand = new Command('list')
  .description('List workflows in a config file')
  .argument('<config>', 'Path to evaluation config file')
  .action(async (configPath: string) => {
    try {
      const { loadConfig } = await import('../eval/config.js');
      const absolutePath = resolve(process.cwd(), configPath);
      const config = await loadConfig(absolutePath);
      
      console.log(chalk.bold('\nAvailable workflows:'));
      for (const workflow of config.workflows) {
        console.log(`  - ${chalk.cyan(workflow.name)}${workflow.description ? `: ${workflow.description}` : ''}`);
        console.log(`    Steps: ${workflow.steps.length}`);
        const toolCount = workflow.steps.reduce((sum, step) => sum + (step.expectTools?.length || 0), 0);
        if (toolCount > 0) {
          console.log(`    Expected tools: ${toolCount}`);
        }
      }
      
      console.log(`\nServer type: ${chalk.yellow(config.server.transport)}`);
      if (config.server.transport === 'stdio') {
        console.log(`Command: ${config.server.command} ${config.server.args?.join(' ') || ''}`);
      } else {
        console.log(`URL: ${config.server.url}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to load config:'), error);
      process.exit(1);
    }
  }); 