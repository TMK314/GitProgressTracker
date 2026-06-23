import { ItemView, WorkspaceLeaf } from 'obsidian';
import type FederstrichPlugin from './main';
import type { AggregatedMetrics } from './types';

export const VIEW_TYPE_FEDERSTRICH = 'federstrich-progress-view';

export class ProgressView extends ItemView {
    plugin: FederstrichPlugin;

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
        // Container für den Inhalt ist das zweite Kind von containerEl
        const contentEl = this.containerEl.children[1];
        if (!contentEl) {
            // View ist noch nicht vollständig aufgebaut – abbrechen
            return;
        }
        contentEl.empty();
        contentEl.createEl('h4', { text: 'Letzte Analyse' });

        const metrics = this.plugin.getLastAggregatedMetrics();
        if (!metrics) {
            contentEl.createEl('p', { text: 'Noch keine Analyse durchgeführt. Führe den Befehl "Fortschritt aktualisieren" aus.' });
            return;
        }

        const table = contentEl.createEl('table');
        const header = table.createEl('tr');
        header.createEl('th', { text: 'Metrik' });
        header.createEl('th', { text: 'Wert' });

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
}