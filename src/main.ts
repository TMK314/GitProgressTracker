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
    metricsStore!: MetricsStore;
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

                    let additions = 0,
                        deletions = 0,
                        revisions = 0;
                    let wordsAdded = 0,
                        wordsDeleted = 0,
                        wordsOldRevised = 0,
                        wordsNewRevised = 0;

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
                                wordsOldRevised += wordCounter.countWordsInLines(block.oldLines);
                                wordsNewRevised += wordCounter.countWordsInLines(block.newLines);
                                break;
                        }
                    }

                    metrics.files['__global__'] = {
                        additions,
                        deletions,
                        revisions,
                        wordsAdded,
                        wordsDeleted,
                        wordsOldRevised,
                        wordsNewRevised
                    };
                    this.metricsStore.addMetrics(metrics);
                    processed++;
                } catch (commitError) {
                    console.error(
                        `Federstrich: Fehler bei Commit ${commit.hash}`,
                        commitError
                    );
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

    computeAggregatedMetrics(): AggregatedMetrics {
        const all = this.metricsStore.getAllMetrics();
        const agg: AggregatedMetrics = {
            totalWordsAdded: 0,
            totalWordsDeleted: 0,
            totalWordsOldRevised: 0,
            totalWordsNewRevised: 0,
            netWords: 0,
            grossWork: 0,
            pureRevision: 0
        };
        for (const m of all) {
            const f = m.files['__global__'];
            if (!f) continue;
            agg.totalWordsAdded += f.wordsAdded;
            agg.totalWordsDeleted += f.wordsDeleted;
            agg.totalWordsOldRevised += f.wordsOldRevised;
            agg.totalWordsNewRevised += f.wordsNewRevised;
        }
        agg.netWords =
            agg.totalWordsAdded -
            agg.totalWordsDeleted +
            (agg.totalWordsNewRevised - agg.totalWordsOldRevised);
        agg.grossWork =
            agg.totalWordsAdded +
            agg.totalWordsDeleted +
            agg.totalWordsOldRevised +
            agg.totalWordsNewRevised;
        agg.pureRevision = agg.totalWordsOldRevised + agg.totalWordsNewRevised;
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
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
        const vaultRoot = (this.app.vault.adapter as any).basePath || '';
        this.gitAnalyzer = new GitAnalyzer(vaultRoot, this.settings);
    }
}