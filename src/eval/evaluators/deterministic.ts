import { TraceStore } from "../core/trace.js";
import { Workflow } from "../core/config.js";
import {
  EvaluationResult,
  WorkflowEvaluation,
} from "../../types/evaluation.js";

export class DeterministicEvaluator {
  private traceStore: TraceStore;

  constructor(traceStore: TraceStore) {
    this.traceStore = traceStore;
  }

  /**
   * Evaluate all three metrics for a workflow
   */
  evaluateWorkflow(workflow: Workflow): WorkflowEvaluation {
    const results: EvaluationResult[] = [];

    // Metric 1: End-to-End Success
    const endToEndResult = this.evaluateEndToEndSuccess(workflow);
    results.push(endToEndResult);

    // Metric 2: Tool Invocation Order
    const toolOrderResult = this.evaluateToolInvocationOrder(workflow);
    results.push(toolOrderResult);

    // Metric 3: Tool Call Health
    const toolHealthResult = this.evaluateToolCallHealth();
    results.push(toolHealthResult);

    // Calculate overall score
    const overallScore =
      results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const passed = results.every((r) => r.passed);

    return {
      workflowName: workflow.name,
      results,
      overallScore,
      passed,
    };
  }

  /**
   * Metric 1: End-to-End Success
   * Check if the workflow reached the desired end state
   */
  private evaluateEndToEndSuccess(workflow: Workflow): EvaluationResult {
    const lastStep = workflow.steps[workflow.steps.length - 1];
    const lastMessage = this.traceStore.getLastMessage();

    if (!lastStep.expectedState || !lastMessage) {
      return {
        metric: "End-to-End Success",
        passed: true,
        score: 1.0,
        details: "No expected state defined or no messages recorded",
      };
    }

    // Check if the last message contains the expected state
    const messageContent = lastMessage.content.toLowerCase();
    const expectedState = lastStep.expectedState.toLowerCase();
    const containsExpectedState = messageContent.includes(expectedState);

    // Also check the last tool result if any
    const toolCalls = this.traceStore.getToolCalls();
    const lastToolCall = toolCalls[toolCalls.length - 1];
    let toolResultMatches = false;

    if (lastToolCall) {
      const toolResult = this.traceStore.getToolResult(lastToolCall.id);
      if (toolResult && toolResult.result) {
        const resultStr = JSON.stringify(toolResult.result).toLowerCase();
        toolResultMatches = resultStr.includes(expectedState);
      }
    }

    const passed = containsExpectedState || toolResultMatches;

    return {
      metric: "End-to-End Success",
      passed,
      score: passed ? 1.0 : 0.0,
      details: passed
        ? `Successfully reached expected state: "${lastStep.expectedState}"`
        : `Failed to reach expected state: "${lastStep.expectedState}"`,
      metadata: {
        expectedState: lastStep.expectedState,
        lastMessageContent: lastMessage.content,
        checkedToolResult: lastToolCall ? true : false,
      },
    };
  }

  /**
   * Metric 2: Tool Invocation Order
   * Check if tools were called in the expected order
   */
  private evaluateToolInvocationOrder(workflow: Workflow): EvaluationResult {
    const actualToolCalls = this.traceStore.getToolCalls().map((tc) => tc.name);
    let expectedTools: string[] = [];

    // First check if workflow has top-level expectTools
    if (workflow.expectTools && workflow.expectTools.length > 0) {
      expectedTools = workflow.expectTools;
    } else {
      // Otherwise collect all expected tools from workflow steps
      for (const step of workflow.steps) {
        if (step.expectTools) {
          expectedTools.push(...step.expectTools);
        }
      }
    }

    if (expectedTools.length === 0) {
      return {
        metric: "Tool Invocation Order",
        passed: true,
        score: 1.0,
        details: "No expected tool order defined",
      };
    }

    // Check if actual tools match expected tools in order
    let matchCount = 0;
    for (
      let i = 0;
      i < Math.min(actualToolCalls.length, expectedTools.length);
      i++
    ) {
      if (actualToolCalls[i] === expectedTools[i]) {
        matchCount++;
      } else {
        break; // Stop at first mismatch
      }
    }

    const allMatch =
      matchCount === expectedTools.length &&
      actualToolCalls.length >= expectedTools.length;
    const score =
      expectedTools.length > 0 ? matchCount / expectedTools.length : 1.0;

    return {
      metric: "Tool Invocation Order",
      passed: allMatch,
      score,
      details: allMatch
        ? `All ${expectedTools.length} tools called in correct order`
        : `Matched ${matchCount}/${expectedTools.length} tools. Expected: [${expectedTools.join(", ")}], Actual: [${actualToolCalls.join(", ")}]`,
      metadata: {
        expectedTools,
        actualTools: actualToolCalls,
        matchCount,
      },
    };
  }

  /**
   * Metric 3: Tool Call Health
   * Check if all tool calls completed successfully
   */
  private evaluateToolCallHealth(): EvaluationResult {
    const toolCalls = this.traceStore.getToolCalls();
    // const toolResults = this.traceStore.getToolResults();

    if (toolCalls.length === 0) {
      return {
        metric: "Tool Call Health",
        passed: true,
        score: 1.0,
        details: "No tool calls made",
      };
    }

    let successCount = 0;
    const failures: string[] = [];

    for (const toolCall of toolCalls) {
      const result = this.traceStore.getToolResult(toolCall.id);

      if (!result) {
        failures.push(`${toolCall.name}: No result recorded`);
        continue;
      }

      if (result.error) {
        failures.push(`${toolCall.name}: ${result.error}`);
        continue;
      }

      if (
        result.httpStatus &&
        (result.httpStatus < 200 || result.httpStatus >= 300)
      ) {
        failures.push(`${toolCall.name}: HTTP ${result.httpStatus}`);
        continue;
      }

      successCount++;
    }

    const score = toolCalls.length > 0 ? successCount / toolCalls.length : 1.0;
    const passed = successCount === toolCalls.length;

    return {
      metric: "Tool Call Health",
      passed,
      score,
      details: passed
        ? `All ${toolCalls.length} tool calls completed successfully`
        : `${successCount}/${toolCalls.length} tool calls succeeded. Failures: ${failures.join("; ")}`,
      metadata: {
        totalCalls: toolCalls.length,
        successCount,
        failures,
      },
    };
  }

  /**
   * Get a summary of the evaluation
   */
  getSummary(): string {
    const toolCalls = this.traceStore.getToolCalls();
    const messages = this.traceStore.getConversation();

    return `Evaluation Summary:
- Messages exchanged: ${messages.length}
- Tool calls made: ${toolCalls.length}
- Tools used: ${[...new Set(toolCalls.map((tc) => tc.name))].join(", ") || "none"}`;
  }
}
