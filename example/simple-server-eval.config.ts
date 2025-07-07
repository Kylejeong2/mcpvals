// import type { Config } from "mcpvals";

const config = {
  server: {
    transport: "stdio",
    command: "node", // automatically swapped to process.execPath by MCPVals
    args: ["./example/simple-mcp-server.js"],
    env: {
      // Any env vars you need – interpolation works in TS too
      NODE_ENV: "test",
    },
  },
  workflows: [
    {
      name: "typescript-calculation-flow",
      description: "LLM-driven multi-step calculation",
      steps: [
        {
          user: "I need to calculate the following: Start with 15, add 27, multiply by 2, then divide by 4. What's the final result?",
          expectedState: "21",
        },
      ],
      expectTools: ["add", "multiply", "divide"],
    },
    {
      name: "typescript-simple-test",
      description: "Single operation test",
      steps: [
        {
          user: "What is 7 times 6?",
          expectedState: "42",
        },
      ],
      // No expectTools - let the LLM figure out which tool to use
    },
  ],
  timeout: 30_000,
  llmJudge: false,
};

export default config;
