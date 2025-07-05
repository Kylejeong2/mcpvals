// Example of programmatic evaluation with TypeScript
// Uncomment and run with: tsx run-evaluation.ts

/*
import { evaluate } from "@mcpvals";

(async () => {
  const report = await evaluate("./example/simple-server-eval.config.ts", {
    debug: true,
    reporter: "console",
  });

  if (!report.passed) {
    console.error("❌ Evaluation failed");
    process.exit(1);
  }

  // You can also access detailed results
  for (const evaluation of report.evaluations) {
    console.log(`Workflow: ${evaluation.workflowName}`);
    console.log(`Passed: ${evaluation.passed}`);
    console.log(`Score: ${evaluation.overallScore}`);
  }
})();
*/
