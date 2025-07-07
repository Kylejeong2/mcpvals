#!/usr/bin/env node

import { Command } from "commander";
import { createEvalCommand, listCommand } from "./eval.js";

const program = new Command();

program
  .name("mcpvals")
  .description("MCP Server Evaluation Tool")
  .version("0.0.1");

// Add commands
program.addCommand(createEvalCommand());
program.addCommand(listCommand);

// Parse arguments
program.parse();
