#!/usr/bin/env node

import { Command } from "commander";
import { evalCommand, listCommand } from "./eval.js";

const program = new Command();

program
  .name("mcpvals")
  .description("MCP Server Evaluation Library")
  .version("0.0.1");

// Add evaluation commands
program.addCommand(evalCommand);
program.addCommand(listCommand);

program.parse();
