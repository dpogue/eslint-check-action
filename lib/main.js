"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
function createCheck(client) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield client.checks.create({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            head_sha: github.context.sha,
            name: github.context.action,
            status: 'in_progress',
            started_at: (new Date()).toISOString()
        });
    });
}
function eslint() {
    return __awaiter(this, void 0, void 0, function* () {
        const workspace = process.env['GITHUB_WORKSPACE'] || '';
        let jsonBuffer = '';
        try {
            yield exec.exec('npx --no-install eslint --format json .', [], {
                cwd: workspace,
                silent: true,
                listeners: {
                    stdout: (data) => {
                        jsonBuffer += data.toString();
                    }
                }
            });
        }
        catch (e) { }
        const levels = ['notice', 'warning', 'failure'];
        const annotations = [];
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
                    core.warning(`${path}\n\t${line} warning: ${message}`);
                }
                else if (severity === 2) {
                    core.error(`${path}\n\t${line} error: ${message}`);
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
    });
}
function updateCheck(client, check_id, conclusion, output) {
    return __awaiter(this, void 0, void 0, function* () {
        core.warning(JSON.stringify(output));
        return client.checks.update({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            check_run_id: check_id,
            status: 'completed',
            completed_at: (new Date()).toISOString(),
            conclusion: conclusion,
            output: output
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const repoToken = core.getInput('repo-token', { required: true });
            const client = new github.GitHub(repoToken);
            const check = yield createCheck(client);
            const { conclusion, output } = yield eslint();
            yield updateCheck(client, check.data.id, conclusion, output);
            if (conclusion === 'failure') {
                throw new Error(output.summary);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
