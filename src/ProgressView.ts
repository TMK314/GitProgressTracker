import { ItemView, WorkspaceLeaf } from 'obsidian';
import type FederstrichPlugin from './main';
import type { AggregatedMetrics, CommitMetrics } from './types';

export const VIEW_TYPE_FEDERSTRICH = 'federstrich-progress-view';

export class ProgressView extends ItemView {
    plugin: FederstrichPlugin;
    private activeTab: 'overview' | 'commits' | 'daily' = 'overview';

    constructor(leaf: WorkspaceLeaf, plugin: FederstrichPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_FEDERSTRICH;
    }

    getDisplayText(): string {
        return 'Federstrich Fortschritt';
    }

    getIcon(): string {
        return 'feather';
    }

    async onOpen(): Promise<void> {
        this.render();
    }

    render(): void {
        const contentEl = this.containerEl.children[1];
        if (!contentEl) return;
        contentEl.empty();

        // Tab-Leiste
        const tabBar = contentEl.createEl('div', { cls: 'federstrich-tabs' });
        this.createTabButton(tabBar, 'Übersicht', 'overview');
        this.createTabButton(tabBar, 'Nach Commit', 'commits');
        this.createTabButton(tabBar, 'Nach Tag', 'daily');

        // Inhalt
        const tabContent = contentEl.createEl('div', { cls: 'federstrich-tab-content' });
        switch (this.activeTab) {
            case 'overview':
                this.renderOverview(tabContent);
                break;
            case 'commits':
                this.renderCommits(tabContent);
                break;
            case 'daily':
                this.renderDaily(tabContent);
                break;
        }
    }

    private createTabButton(parent: HTMLElement, label: string, tab: 'overview' | 'commits' | 'daily') {
        const btn = parent.createEl('button', { text: label, cls: 'federstrich-tab-btn' });
        if (this.activeTab === tab) btn.addClass('active');
        btn.onclick = () => {
            this.activeTab = tab;
            this.render();
        };
    }

    private renderOverview(container: HTMLElement) {
        const metrics = this.plugin.getLastAggregatedMetrics();
        if (!metrics) {
            container.createEl('p', { text: 'Noch keine Analyse durchgeführt.' });
            return;
        }
        container.createEl('h4', { text: 'Gesamtstatistik' });
        const table = container.createEl('table');
        const rows: [string, number][] = [
            ['Netto-Wortdifferenz', metrics.netWords],
            ['Brutto-Arbeitsvolumen', metrics.grossWork],
            ['Reine Überarbeitung', metrics.pureRevision],
            ['Neue Wörter (reine Addition)', metrics.totalWordsAdded],
            ['Gelöschte Wörter (reine Löschung)', metrics.totalWordsDeleted],
            ['Alte Wörter (überarbeitet)', metrics.totalWordsOldRevised],
            ['Neue Wörter (überarbeitet)', metrics.totalWordsNewRevised]
        ];
        for (const [label, value] of rows) {
            const row = table.createEl('tr');
            row.createEl('td', { text: label });
            row.createEl('td', { text: value.toString() });
        }
    }

    private renderCommits(container: HTMLElement) {
        const allCommits = this.plugin.metricsStore.getAllMetrics();
        if (allCommits.length === 0) {
            container.createEl('p', { text: 'Keine Commits analysiert.' });
            return;
        }
        container.createEl('h4', { text: 'Commits' });
        const table = container.createEl('table');
        const header = table.createEl('tr');
        header.createEl('th', { text: 'Datum' });
        header.createEl('th', { text: 'Commit' });
        header.createEl('th', { text: '+ Wörter' });
        header.createEl('th', { text: '- Wörter' });
        header.createEl('th', { text: 'Überarb.' });

        for (const cm of allCommits) {
            const global = cm.files['__global__'];
            if (!global) continue;
            const date = new Date(cm.timestamp * 1000).toLocaleDateString();
            const row = table.createEl('tr');
            row.createEl('td', { text: date });
            const hashCell = row.createEl('td');
            hashCell.createEl('span', { text: cm.hash.substring(0, 7), cls: 'commit-hash' });
            hashCell.createEl('span', { text: ` ${cm.message}`, cls: 'commit-msg' });
            row.createEl('td', { text: global.wordsAdded.toString() });
            row.createEl('td', { text: global.wordsDeleted.toString() });
            row.createEl('td', { text: (global.wordsOldRevised + global.wordsNewRevised).toString() });
        }
    }

    private renderDaily(container: HTMLElement) {
        const allCommits = this.plugin.metricsStore.getAllMetrics();
        if (allCommits.length === 0) {
            container.createEl('p', { text: 'Keine Commits analysiert.' });
            return;
        }
        // Nach Tag gruppieren
        const dailyMap = new Map<string, { added: number; deleted: number; revised: number }>();
        for (const cm of allCommits) {
            const global = cm.files['__global__'];
            if (!global) continue;
            const dateKey = new Date(cm.timestamp * 1000).toLocaleDateString();
            const entry = dailyMap.get(dateKey) || { added: 0, deleted: 0, revised: 0 };
            entry.added += global.wordsAdded;
            entry.deleted += global.wordsDeleted;
            entry.revised += global.wordsOldRevised + global.wordsNewRevised;
            dailyMap.set(dateKey, entry);
        }
        // Sortierte Tage (neueste zuerst)
        const sortedDays = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

        container.createEl('h4', { text: 'Tägliche Zusammenfassung' });
        const table = container.createEl('table');
        const header = table.createEl('tr');
        header.createEl('th', { text: 'Datum' });
        header.createEl('th', { text: 'Neue Wörter' });
        header.createEl('th', { text: 'Gelöschte Wörter' });
        header.createEl('th', { text: 'Überarbeitung' });
        header.createEl('th', { text: 'Netto' });
        header.createEl('th', { text: 'Arbeitsvolumen' });

        for (const [date, vals] of sortedDays) {
            const net = vals.added - vals.deleted;
            const gross = vals.added + vals.deleted + vals.revised;
            const row = table.createEl('tr');
            row.createEl('td', { text: date });
            row.createEl('td', { text: vals.added.toString() });
            row.createEl('td', { text: vals.deleted.toString() });
            row.createEl('td', { text: vals.revised.toString() });
            row.createEl('td', { text: net.toString() });
            row.createEl('td', { text: gross.toString() });
        }
    }
}