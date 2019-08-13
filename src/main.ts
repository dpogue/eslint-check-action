import * as core from '@actions/core';
import * as github from '@actions/github';
import * as Octokit from '@octokit/rest';

async function createCheck(client : github.GitHub) {
  return await client.checks.create({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    head_sha: github.context.sha,
    name: github.context.action,
    status: 'in_progress',
    started_at: (new Date()).toISOString()
  });
}

function eslint() {
  const workspace = process.env['GITHUB_WORKSPACE'] || '';
  const eslint = require('eslint');

  const cli = new eslint.CLIEngine();
  const report = cli.executeOnFiles([workspace || '.']);

  const { results, errorCount, warningCount } = report;
  const levels : ['notice', 'warning', 'failure'] = ['notice', 'warning', 'failure'];

  const annotations : Array<Octokit.ChecksUpdateParamsOutputAnnotations> = [];
  for (const result of results) {
    const { filePath, messages } = result;
    const path = filePath.substring(workspace.length + 1);

    for (const msg of messages) {
      const { line, severity, ruleId, message } = msg;
      const annotationLevel = levels[severity];
      annotations.push({
        path: path,
        start_line: line,
        end_line: line,
        annotation_level: annotationLevel,
        message: `[${ruleId}] ${message}`
      });
    }
  }

  return {
    conclusion: errorCount > 0 ? 'failure' : 'success',
    output: {
      title: github.context.action,
      summary: `${errorCount} error(s), ${warningCount} warning(s) found`,
      annotations
    }
  };
}


async function updateCheck(client : github.GitHub, check_id : number, conclusion : string, output : any) {
  return client.checks.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    check_run_id: check_id,
    status: 'completed',
    completed_at: (new Date()).toISOString(),
    conclusion: conclusion as 'failure'|'success',
    output: output
  });
}

async function run() {
  try {
    const repoToken = core.getInput('repo-token', { required: true });
    const client = new github.GitHub(repoToken);

    const check = await createCheck(client);

    const { conclusion, output } = eslint();

    await updateCheck(client, check.data.id, conclusion, output);

    if (conclusion === 'failure') {
        throw new Error(output.summary);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
