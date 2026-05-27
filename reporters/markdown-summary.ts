import fs from 'fs';
import path from 'path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM MARKDOWN REPORTER
// Generates a test-summary.md file after each test run with:
//   - Pass/fail/skip counts and duration
//   - Breakdown by test file and browser project
//   - List of failures with error messages
//   - Flaky test warnings (tests that passed on retry)
//
// Usage: add to playwright.config.ts reporters array:
//   reporter: [['list'], ['./reporters/markdown-summary.ts']]
// ─────────────────────────────────────────────────────────────────────────────

interface TestRecord {
  title: string;
  file: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  error?: string;
  retry: number;
}

class MarkdownSummaryReporter implements Reporter {
  private records: TestRecord[] = [];
  private startTime = 0;

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const file = path.basename(test.location.file);
    const project = test.parent.project()?.name || 'unknown';

    // A test that failed initially but passed on retry is flaky
    const isFlaky = result.status === 'passed' && result.retry > 0;

    this.records.push({
      title: test.title,
      file,
      project,
      status: isFlaky ? 'flaky' : (result.status as 'passed' | 'failed' | 'skipped'),
      duration: result.duration,
      error: result.status === 'failed'
        ? result.errors.map(e => e.message || '').join('\n').slice(0, 200)
        : undefined,
      retry: result.retry,
    });
  }

  onEnd(result: FullResult) {
    const totalDuration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    const passed = this.records.filter(r => r.status === 'passed');
    const failed = this.records.filter(r => r.status === 'failed');
    const skipped = this.records.filter(r => r.status === 'skipped');
    const flaky = this.records.filter(r => r.status === 'flaky');

    const lines: string[] = [];

    // Header
    lines.push('# Test Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| **Status** | ${result.status === 'passed' ? 'PASSED' : 'FAILED'} |`);
    lines.push(`| **Total** | ${this.records.length} |`);
    lines.push(`| **Passed** | ${passed.length} |`);
    lines.push(`| **Failed** | ${failed.length} |`);
    lines.push(`| **Skipped** | ${skipped.length} |`);
    lines.push(`| **Flaky** | ${flaky.length} |`);
    lines.push(`| **Duration** | ${totalDuration}s |`);
    lines.push(`| **Date** | ${new Date().toISOString().split('T')[0]} |`);
    lines.push('');

    // By file
    lines.push('## Results by File');
    lines.push('');
    lines.push('| File | Passed | Failed | Skipped | Flaky |');
    lines.push('|------|--------|--------|---------|-------|');

    const files = [...new Set(this.records.map(r => r.file))].sort();
    for (const file of files) {
      const fileRecords = this.records.filter(r => r.file === file);
      const p = fileRecords.filter(r => r.status === 'passed').length;
      const f = fileRecords.filter(r => r.status === 'failed').length;
      const s = fileRecords.filter(r => r.status === 'skipped').length;
      const fl = fileRecords.filter(r => r.status === 'flaky').length;
      lines.push(`| ${file} | ${p} | ${f} | ${s} | ${fl} |`);
    }
    lines.push('');

    // By project (browser)
    lines.push('## Results by Browser');
    lines.push('');
    lines.push('| Browser | Passed | Failed | Skipped |');
    lines.push('|---------|--------|--------|---------|');

    const projects = [...new Set(this.records.map(r => r.project))].sort();
    for (const project of projects) {
      const projRecords = this.records.filter(r => r.project === project);
      const p = projRecords.filter(r => r.status === 'passed' || r.status === 'flaky').length;
      const f = projRecords.filter(r => r.status === 'failed').length;
      const s = projRecords.filter(r => r.status === 'skipped').length;
      lines.push(`| ${project} | ${p} | ${f} | ${s} |`);
    }
    lines.push('');

    // Failures
    if (failed.length > 0) {
      lines.push('## Failures');
      lines.push('');
      for (const record of failed) {
        lines.push(`### ${record.project} > ${record.file}`);
        lines.push(`**${record.title}**`);
        lines.push('```');
        lines.push(record.error || 'No error message captured');
        lines.push('```');
        lines.push('');
      }
    }

    // Flaky tests
    if (flaky.length > 0) {
      lines.push('## Flaky Tests (passed on retry)');
      lines.push('');
      lines.push('These tests failed initially but passed on retry. They should be investigated:');
      lines.push('');
      for (const record of flaky) {
        lines.push(`- **${record.title}** (${record.file}, ${record.project}) — passed on retry #${record.retry}`);
      }
      lines.push('');
    }

    // Write the file
    const outputPath = path.join(process.cwd(), 'test-summary.md');
    fs.writeFileSync(outputPath, lines.join('\n'));
  }
}

export default MarkdownSummaryReporter;
