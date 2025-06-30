// import type { Config } from "@mcpvals";

// const config: Config = {
//   server: {
//     transport: "stdio",
//     command: "node", // automatically swapped to process.execPath by MCPVals
//     args: ["./example/simple-mcp-server.js"],
//     env: {
//       // Any env vars you need – interpolation works in TS too
//       NODE_ENV: "test",
//     },
//   },
//   workflows: [
//     {
//       name: "typescript-happy-path",
//       description: "Same as JSON example, but written in TS for type-safety",
//       steps: [
//         {
//           user: "What is 7 times 6?",
//           expectTools: ["multiply"],
//           expectedState: "42",
//         },
//       ],
//     },
//   ],
//   timeout: 30_000,
//   llmJudge: false,
// };

// export default config;
