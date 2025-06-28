import chalk from 'chalk';
import { WorkflowEvaluation, EvaluationResult } from '../deterministic.js';

export class ConsoleReporter {
  /**
   * Report evaluation results to the console
   */
  report(evaluations: WorkflowEvaluation[]): void {
    console.log('\n' + chalk.bold.underline('MCP Server Evaluation Results'));
    console.log('=' .repeat(60));

    for (const evaluation of evaluations) {
      this.reportWorkflow(evaluation);
    }

    this.reportSummary(evaluations);
  }

  /**
   * Report a single workflow evaluation
   */
  private reportWorkflow(evaluation: WorkflowEvaluation): void {
    const statusIcon = evaluation.passed ? chalk.green('✓') : chalk.red('✗');
    const statusText = evaluation.passed ? chalk.green('PASSED') : chalk.red('FAILED');
    
    console.log(`\n${chalk.bold('Workflow:')} ${evaluation.workflowName} ${statusIcon} ${statusText}`);
    console.log(`${chalk.bold('Overall Score:')} ${this.formatScore(evaluation.overallScore)}`);
    console.log('-'.repeat(40));

    for (const result of evaluation.results) {
      this.reportMetric(result);
    }
  }

  /**
   * Report a single metric result
   */
  private reportMetric(result: EvaluationResult): void {
    const icon = result.passed ? chalk.green('✓') : chalk.red('✗');
    const score = this.formatScore(result.score);
    
    console.log(`  ${icon} ${chalk.bold(result.metric)}: ${score}`);
    console.log(`    ${chalk.gray(result.details)}`);
    
    if (result.metadata && Object.keys(result.metadata).length > 0) {
      if (result.metadata.failures && Array.isArray(result.metadata.failures) && result.metadata.failures.length > 0) {
        console.log(`    ${chalk.red('Failures:')}`);
        for (const failure of result.metadata.failures) {
          console.log(`      - ${failure}`);
        }
      }
    }
  }

  /**
   * Report overall summary
   */
  private reportSummary(evaluations: WorkflowEvaluation[]): void {
    const totalWorkflows = evaluations.length;
    const passedWorkflows = evaluations.filter(e => e.passed).length;
    const failedWorkflows = totalWorkflows - passedWorkflows;
    const overallScore = evaluations.reduce((sum, e) => sum + e.overallScore, 0) / totalWorkflows;

    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold('Summary:'));
    console.log(`  Total Workflows: ${totalWorkflows}`);
    console.log(`  Passed: ${chalk.green(passedWorkflows)}`);
    console.log(`  Failed: ${chalk.red(failedWorkflows)}`);
    console.log(`  Overall Score: ${this.formatScore(overallScore)}`);
    
    if (failedWorkflows > 0) {
      console.log(`\n${chalk.red.bold('❌ Evaluation Failed')}`);
    } else {
      console.log(`\n${chalk.green.bold('✅ All Evaluations Passed!')}`);
    }
  }

  /**
   * Format a score as a percentage with color
   */
  private formatScore(score: number): string {
    const percentage = Math.round(score * 100);
    if (score >= 1.0) {
      return chalk.green(`${percentage}%`);
    } else if (score >= 0.7) {
      return chalk.yellow(`${percentage}%`);
    } else {
      return chalk.red(`${percentage}%`);
    }
  }
} 