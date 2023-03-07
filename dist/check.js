"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const sync_1 = __importDefault(require("csv-parse/lib/sync"));
const axios_1 = __importDefault(require("axios"));
function checkMFA(username) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios_1.default.get(`https://api.github.com/users/${username}/mfa`);
        return response.status === 200;
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput('token');
            const octokit = github.getOctokit(token);
            const org = core.getInput('org');
            const excludeUsersFile = core.getInput('exclude_users_file');
            const excludeUsers = fs.existsSync(excludeUsersFile)
                ? (0, sync_1.default)(fs.readFileSync(excludeUsersFile), { columns: true })
                : [];
            const orgRepos = yield octokit.paginate(octokit.repos.listForOrg, { org, type: 'all' });
            const data = [];
            const admins = [];
            const header = ['organization', 'repository', 'name', 'login', 'permission', 'mfa'];
            data.push(header);
            admins.push(header);
            for (const repo of orgRepos) {
                if (repo.permissions.admin) {
                    admins.push([org, repo.name, '', '', 'admin']);
                }
                const repoCollabs = yield octokit.paginate(octokit.repos.listCollaborators, { org, repo: repo.name });
                for (const collab of repoCollabs) {
                    const isExcluded = excludeUsers.some((excludeUser) => excludeUser.repository.toLowerCase() === repo.name.toLowerCase() &&
                        excludeUser.login.toLowerCase() === collab.login.toLowerCase());
                    if (!isExcluded) {
                        const mfaEnabled = yield checkMFA(collab.login);
                        data.push([org, repo.name, collab.name || '', collab.login, collab.permissions.admin ? 'admin' : 'write', String(mfaEnabled)]);
                    }
                }
            }
            const artifactFileName = core.getInput('artifact_file_name');
            fs.writeFileSync(`${artifactFileName}.csv`, data.map((row) => row.join(',')).join('\n'));
            fs.writeFileSync(`${artifactFileName}_admins.csv`, admins.map((row) => row.join(',')).join('\n'));
            const issueNumber = github.context.issue.number;
            const repository = github.context.payload.repository;
            if (issueNumber && repository) {
                const issueComment = octokit.issues.createComment({
                    owner: repository.owner.login,
                    repo: repository.name,
                    issue_number: issueNumber,
                    body: 'Admins CSV:',
                    attachments: [
                        {
                            title: `${artifactFileName}_admins.csv`,
                            file_type: 'csv',
                            data: Buffer.from(fs.readFileSync(`${artifactFileName}_admins.csv`)).toString('base64')
                        }
                    ]
                });
                console.log(`Admins CSV has been added to issue #${issueNumber}.`);
            }
            else {
                console.log(`Admins CSV:\n${fs.readFileSync(`${artifactFileName}_admins.csv`)}`);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
