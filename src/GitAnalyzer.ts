import { exec } from 'child_process';
import { promisify } from 'util';
import type { FederstrichSettings } from './types';

const execAsync = promisify(exec);

export interface GitCommit {
    hash: string;
    timestamp: number;
    message: string;
}

export class GitAnalyzer {
    private repoPath: string;
    private settings: FederstrichSettings;

    constructor(vaultRoot: string, settings: FederstrichSettings) {
        this.repoPath = settings.repoPath ? `${vaultRoot}/${settings.repoPath}` : vaultRoot;
        this.settings = settings;
    }

    private async runGit(args: string): Promise<string> {
        const { stdout } = await execAsync(`git ${args}`, { cwd: this.repoPath });
        return stdout;
    }

    async getCommits(since?: Date): Promise<GitCommit[]> {
        let range = '';
        if (since) {
            range = `--since="${since.toISOString()}"`;
        }
        let authorFilter = '';
        if (this.settings.authorFilter) {
            authorFilter = `--author="${this.settings.authorFilter}"`;
        }
        const output = await this.runGit(
            `log --pretty=format:"%H %ct %s" ${range} ${authorFilter}`
        );
        if (!output.trim()) return [];

        return output
            .trim()
            .split('\n')
            .map((line) => {
                const parts = line.split(' ');
                if (parts.length < 3) return null;
                const hash = parts[0];
                if (parts[1] === undefined) return null;
                const timestamp = parseInt(parts[1], 10);
                const message = parts.slice(2).join(' ');
                if (!hash || hash.length !== 40 || isNaN(timestamp)) return null;
                return { hash, timestamp, message } as GitCommit;
            })
            .filter((entry): entry is GitCommit => entry !== null);
    }

    async getDiff(commitHash: string): Promise<string> {
        // `git show --format=` gibt nur den Diff aus, funktioniert auch für initiale Commits
        return await this.runGit(`show ${commitHash} --format=`);
    }
}