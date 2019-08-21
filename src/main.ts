import * as core from '@actions/core';
import * as exec from '@actions/exec';
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

async function eslint() {
  const workspace = process.env['GITHUB_WORKSPACE'] || '';
  let jsonBuffer = '';

  try {
    await exec.exec('npx --no-install eslint --format json .', [], {
      cwd: workspace,
      silent: true,
      listeners: {
        stdout: (data : Buffer) => {
          jsonBuffer += data.toString();
        }
      }
    });
  } catch(e) { }

  const levels : ['notice', 'warning', 'failure'] = ['notice', 'warning', 'failure'];
  const annotations : Array<Octokit.ChecksUpdateParamsOutputAnnotations> = [];
  const report = JSON.parse(jsonBuffer);
  let errors = 0;
  let warnings = 0;

  for (const result of report) {
    const { filePath, messages, errorCount, warningCount } = result;
    const path = filePath.substring(workspace.length + 1);

    errors += errorCount;
    warnings += warningCount;

    for (const msg of messages) {
      const { line, severity, ruleId, message } = msg;
      const annotationLevel = levels[severity];

      if (severity === 1) {
        core.warning(`${path}\n\t${line}  warning:  ${message}  [${ruleId}]`);
      } else if (severity === 2) {
        core.error(`${path}\n\t${line}  error:  ${message}  [${ruleId}]`);
      }

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
    conclusion: errors > 0 ? 'failure' : 'success',
    output: {
      title: github.context.action,
      summary: `${errors} error(s), ${warnings} warning(s) found`,
      annotations
    }
  };
}


async function updateCheck(client : github.GitHub, check_id : number, conclusion : string, output : any) {
  core.warning(JSON.stringify(output));

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

    const { conclusion, output } = await eslint();

    await updateCheck(client, check.data.id, conclusion, output);

    if (conclusion === 'failure') {
        throw new Error(output.summary);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
