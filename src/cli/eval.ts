import { Command } from "commander";
import { evaluate } from "../eval/index.js";
import chalk from "chalk";
import { resolve } from "path";

export function createEvalCommand(): Command {
  const evalCmd = new Command("eval");

  evalCmd
    .description(
      "Evaluate an MCP server using workflows and/or tool health tests",
    )
    .argument("<config>", "Path to evaluation configuration file")
    .option("-d, --debug", "Enable debug output")
    .option("-r, --reporter <type>", "Output format", "console")
    .option("--llm-judge", "Enable LLM judge evaluation")
    .option("--tool-health-only", "Run only tool health tests, skip workflows")
    .option("--workflows-only", "Run only workflows, skip tool health tests")
    .action(async (configPath: string, options) => {
      try {
        const result = await evaluate(configPath, {
          debug: options.debug,
          reporter: options.reporter,
          llmJudge: options.llmJudge,
          toolHealthOnly: options.toolHealthOnly,
          workflowsOnly: options.workflowsOnly,
        });

        // Exit with error code if evaluation failed
        if (!result.passed) {
          process.exit(1);
        }
      } catch (error) {
        console.error("Evaluation failed:", error);
        process.exit(1);
      }
    });

  return evalCmd;
}

// List command to show available workflows
export const listCommand = new Command("list")
  .description("List workflows in a config file")
  .argument("<config>", "Path to evaluation config file")
  .action(async (configPath: string) => {
    try {
      const { loadConfig } = await import("../eval/config.js");
      const absolutePath = resolve(process.cwd(), configPath);
      const config = await loadConfig(absolutePath);

      console.log(chalk.bold("\nAvailable workflows:"));
      for (const workflow of config.workflows) {
        console.log(
          `  - ${chalk.cyan(workflow.name)}${workflow.description ? `: ${workflow.description}` : ""}`,
        );
        console.log(`    Steps: ${workflow.steps.length}`);
        const toolCount = workflow.steps.reduce(
          (sum, step) => sum + (step.expectTools?.length || 0),
          0,
        );
        if (toolCount > 0) {
          console.log(`    Expected tools: ${toolCount}`);
        }
      }

      console.log(`\nServer type: ${chalk.yellow(config.server.transport)}`);
      if (config.server.transport === "stdio") {
        console.log(
          `Command: ${config.server.command} ${config.server.args?.join(" ") || ""}`,
        );
      } else {
        console.log(`URL: ${config.server.url}`);
      }
    } catch (error) {
      console.error(chalk.red("❌ Failed to load config:"), error);
      process.exit(1);
    }
  });
