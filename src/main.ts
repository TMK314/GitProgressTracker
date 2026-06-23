import { Plugin, Notice, WorkspaceLeaf } from 'obsidian';
import type { FederstrichSettings, CommitMetrics, AggregatedMetrics } from './types';
import { DEFAULT_SETTINGS } from './types';
import { FederstrichSettingTab } from './settings';
import { GitAnalyzer } from './GitAnalyzer';
import { DiffParser } from './DiffParser';
import { WordCounter } from './WordCounter';
import { MetricsStore } from './MetricsStore';
import { ProgressView, VIEW_TYPE_FEDERSTRICH } from './ProgressView';

export default class FederstrichPlugin extends Plugin {
    settings!: FederstrichSettings;
    gitAnalyzer!: GitAnalyzer;
    metricsStore!: MetricsStore;         // public, damit die View darauf zugreifen kann
    private lastAggregated: AggregatedMetrics | null = null;

    async onload() {
        await this.loadSettings();

        const vaultRoot = (this.app.vault.adapter as any).basePath || '';
        this.metricsStore = new MetricsStore(this.app.vault, this.manifest.dir!);
        await this.metricsStore.load();

        this.gitAnalyzer = new GitAnalyzer(vaultRoot, this.settings);

        this.addSettingTab(new FederstrichSettingTab(this.app, this));

        this.registerView(
            VIEW_TYPE_FEDERSTRICH,
            (leaf) => new ProgressView(leaf, this)
        );

        this.addRibbonIcon('feather', 'Federstrich Fortschritt', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'federstrich-update-progress',
            name: 'Fortschritt aktualisieren',
            callback: () => this.updateProgress()
        });

        this.addCommand({
            id: 'federstrich-show-view',
            name: 'Fortschrittsansicht öffnen',
            callback: () => this.activateView()
        });

        this.addCommand({
            id: 'federstrich-reset-cache',
            name: 'Cache leeren & alles neu analysieren',
            callback: () => this.resetAndUpdate()
        });
    }

    async resetAndUpdate() {
        this.metricsStore.clear();
        await this.metricsStore.save();
        this.lastAggregated = null;
        await this.updateProgress();
    }

    async updateProgress() {
        const notice = new Notice('Analysiere Git-Commits...');
        try {
            const lastCommit = this.metricsStore.getAllMetrics()?.[0];
            let since: Date | undefined = undefined;
            if (lastCommit) {
                since = new Date(lastCommit.timestamp * 1000);
            }
            const commits = await this.gitAnalyzer.getCommits(since);
            if (commits.length === 0) {
                notice.setMessage('Keine neuen Commits gefunden.');
                return;
            }

            const diffParser = new DiffParser(
                this.settings.maxRevisionDistance,
                this.settings.includePattern
            );
            const wordCounter = new WordCounter(this.settings.wordSeparatorRegex);
            let processed = 0;
            let errors = 0;

            for (const commit of commits) {
                if (this.metricsStore.hasCommit(commit.hash)) continue;
                try {
                    const diff = await this.gitAnalyzer.getDiff(commit.hash);
                    const blocks = diffParser.parse(diff);
                    const metrics: CommitMetrics = {
                        hash: commit.hash,
                        timestamp: commit.timestamp,
                        message: commit.message,
                        files: {}
                    };

                    let additions = 0, deletions = 0, revisions = 0;
                    let wordsAdded = 0, wordsDeleted = 0;
                    let revisionWords = 0, revisionNetWords = 0;

                    for (const block of blocks) {
                        switch (block.type) {
                            case 'addition':
                                additions += block.newLines.length;
                                wordsAdded += wordCounter.countWordsInLines(block.newLines);
                                break;
                            case 'deletion':
                                deletions += block.oldLines.length;
                                wordsDeleted += wordCounter.countWordsInLines(block.oldLines);
                                break;
                            case 'revision':
                                revisions++;
                                const oldTokens = wordCounter.tokenizeLines(block.oldLines);
                                const newTokens = wordCounter.tokenizeLines(block.newLines);
                                revisionWords += FederstrichPlugin.calculateRevisionWords(oldTokens, newTokens);
                                revisionNetWords += newTokens.length - oldTokens.length;
                                break;
                        }
                    }

                    metrics.files['__global__'] = {
                        additions,
                        deletions,
                        revisions,
                        wordsAdded,
                        wordsDeleted,
                        revisionWords,
                        revisionNetWords
                    };
                    this.metricsStore.addMetrics(metrics);
                    processed++;
                } catch (commitError) {
                    console.error(`Federstrich: Fehler bei Commit ${commit.hash}`, commitError);
                    errors++;
                }
            }

            await this.metricsStore.save();
            this.computeAggregatedMetrics();
            this.updateView();

            notice.setMessage(
                `${processed} Commits analysiert` +
                (errors > 0 ? `, ${errors} Fehler (siehe Konsole)` : '')
            );
        } catch (e) {
            console.error('Federstrich update error', e);
            notice.setMessage('Fehler bei der Analyse. Details in der Konsole.');
        }
    }

    /**
     * Berechnet die Anzahl bearbeiteter Wörter durch Vergleich der Worthäufigkeiten.
     */
    static calculateRevisionWords(oldTokens: string[], newTokens: string[]): number {
        const m = oldTokens.length;
        const n = newTokens.length;
        // Levenshtein-Distanz: Insert, Delete, Substitute kosten je 1
        const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++)
            {
                if (dp[i] !== undefined)
                dp[i]![0] = i;
            }
        for (let j = 0; j <= n; j++)
            {
                if (dp[0] !== undefined)
                dp[0]![j] = j;
            }

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = oldTokens[i - 1] === newTokens[j - 1] ? 0 : 1;
                if (dp[i] !== undefined && dp[i - 1] !== undefined)
                {
                    if (dp[i]![j - 1] !== undefined && dp[i - 1]![j - 1] !== undefined)
                    {
                        dp[i]![j] = Math.min(
                            dp[i - 1]![j]! + 1,       // Löschen
                            dp[i]![j - 1]! + 1,       // Einfügen
                            dp[i - 1]![j - 1]! + cost // Ersetzen (1, wenn ungleich)
                        );
                    }
                }
            }
        }
        if (dp[m] !== undefined && dp[m][n] !== undefined)
        return dp[m][n];
        return 0;
    }

    computeAggregatedMetrics(): AggregatedMetrics {
        const all = this.metricsStore.getAllMetrics();
        const agg: AggregatedMetrics = {
            totalWordsAdded: 0,
            totalWordsDeleted: 0,
            totalRevisionWords: 0,
            totalRevisionNetWords: 0,
            netWords: 0,
            grossWork: 0,
            pureRevision: 0
        };
        for (const m of all) {
            const f = m.files['__global__'];
            if (!f) continue;
            agg.totalWordsAdded += f.wordsAdded;
            agg.totalWordsDeleted += f.wordsDeleted;
            agg.totalRevisionWords += f.revisionWords;
            agg.totalRevisionNetWords += f.revisionNetWords;
        }
        agg.netWords = agg.totalWordsAdded - agg.totalWordsDeleted + agg.totalRevisionNetWords;
        agg.grossWork = agg.totalWordsAdded + agg.totalWordsDeleted + agg.totalRevisionWords;
        agg.pureRevision = agg.totalRevisionWords;
        this.lastAggregated = agg;
        return agg;
    }

    getLastAggregatedMetrics(): AggregatedMetrics | null {
        return this.lastAggregated;
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null =
            workspace.getLeavesOfType(VIEW_TYPE_FEDERSTRICH)[0] ?? null;

        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            if (!leaf) return;
            await leaf.setViewState({
                type: VIEW_TYPE_FEDERSTRICH,
                active: true
            });
        }
        workspace.revealLeaf(leaf);
        this.updateView();
    }

    updateView() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FEDERSTRICH);
        for (const leaf of leaves) {
            if (leaf.view instanceof ProgressView) {
                leaf.view.render();
            }
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        const vaultRoot = (this.app.vault.adapter as any).basePath || '';
        this.gitAnalyzer = new GitAnalyzer(vaultRoot, this.settings);
    }
}