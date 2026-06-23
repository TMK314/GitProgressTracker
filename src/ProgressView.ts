import { ItemView, WorkspaceLeaf } from 'obsidian';
import type FederstrichPlugin from './main';
import type { AggregatedMetrics } from './types';

export const VIEW_TYPE_FEDERSTRICH = 'federstrich-progress-view';

export class ProgressView extends ItemView {
    plugin: FederstrichPlugin;
    private activeTab: 'overview' | 'commits' | 'daily' = 'overview';
    private heatmapRotated: boolean = false;

    constructor(leaf: WorkspaceLeaf, plugin: FederstrichPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string { return VIEW_TYPE_FEDERSTRICH; }
    getDisplayText(): string { return 'Federstrich Fortschritt'; }
    getIcon(): string { return 'feather'; }

    async onOpen(): Promise<void> { this.render(); }

    render(): void {
        const contentEl = this.containerEl.children[1];
        if (!contentEl) return;
        contentEl.empty();

        const tabBar = contentEl.createEl('div', { cls: 'federstrich-tabs' });
        this.createTabButton(tabBar, 'Übersicht', 'overview');
        this.createTabButton(tabBar, 'Nach Commit', 'commits');
        this.createTabButton(tabBar, 'Nach Tag', 'daily');

        const tabContent = contentEl.createEl('div', { cls: 'federstrich-tab-content' });
        switch (this.activeTab) {
            case 'overview': this.renderOverview(tabContent); break;
            case 'commits': this.renderCommits(tabContent); break;
            case 'daily': this.renderDaily(tabContent); break;
        }
    }

    private createTabButton(parent: HTMLElement, label: string, tab: 'overview' | 'commits' | 'daily') {
        const btn = parent.createEl('button', { text: label, cls: 'federstrich-tab-btn' });
        if (this.activeTab === tab) btn.addClass('active');
        btn.onclick = () => { this.activeTab = tab; this.render(); };
    }

    private renderOverview(container: HTMLElement) {
        const btnRow = container.createEl('div', { cls: 'heatmap-controls' });
        const rotateBtn = btnRow.createEl('button', { text: 'Ansicht drehen', cls: 'federstrich-btn' });
        rotateBtn.onclick = () => {
            this.heatmapRotated = !this.heatmapRotated;
            this.render();
        };

        this.renderHeatmap(container);

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
            ['Reine Überarbeitung (bearbeitete Wörter)', metrics.pureRevision],
            ['Neue Wörter (Additionen)', metrics.totalWordsAdded],
            ['Gelöschte Wörter (Löschungen)', metrics.totalWordsDeleted],
            ['Überarbeitung Netto-Änderung', metrics.totalRevisionNetWords]
        ];
        for (const [label, value] of rows) {
            const row = table.createEl('tr');
            row.createEl('td', { text: label });
            row.createEl('td', { text: value.toString() });
        }
    }

    private renderHeatmap(container: HTMLElement) {
        const settings = this.plugin.settings;
        const dailyGoal = settings.dailyGoal;
        const weights = settings.writingIndexWeights;

        const dailyScores = this.getDailyWeightedScores(weights);
        const allCommits = this.plugin.metricsStore.getAllMetrics();

        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Startdatum = frühester Commit-Tag oder 365 Tage vor heute als Fallback
        let startDate: Date;
        if (allCommits.length > 0) {
            const minTimestamp = Math.min(...allCommits.map(c => c.timestamp));
            startDate = new Date(minTimestamp * 1000);
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        } else {
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 365);
        }

        // Sicherstellen, dass der Zeitraum mindestens 365 Tage umfasst (für einheitliches Aussehen)
        if ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) < 365) {
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 365);
        }

        const days: Date[] = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }

        const weeks: { startDate: Date; days: { date: Date; score: number }[] }[] = [];
        let currentWeek: { startDate: Date; days: { date: Date; score: number }[] } | null = null;
        for (const date of days) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || !currentWeek) {
                if (currentWeek) weeks.push(currentWeek);
                currentWeek = { startDate: date, days: [] };
            }
            const dateKey = this.formatLocalDateKey(date);
            const score = dailyScores.get(dateKey) || 0;
            currentWeek!.days.push({ date, score });
        }
        if (currentWeek) weeks.push(currentWeek);

        const monthHeaders: { label: string; colSpan: number }[] = [];
        let lastMonth = -1;
        for (const week of weeks) {
            const month = week.startDate.getMonth();
            if (month !== lastMonth) {
                monthHeaders.push({ label: week.startDate.toLocaleString('default', { month: 'short' }), colSpan: 1 });
            } else {
                if (monthHeaders !== undefined)
                    if (monthHeaders[monthHeaders.length - 1] !== undefined)
                        monthHeaders[monthHeaders.length - 1]!.colSpan++;
            }
            lastMonth = month;
        }

        const heatmapDiv = container.createEl('div', { cls: 'federstrich-heatmap' });

        if (!this.heatmapRotated) {
            const table = heatmapDiv.createEl('table', { cls: 'heatmap-table' });
            const thead = table.createEl('thead');
            const tbody = table.createEl('tbody');

            const headerRow = thead.createEl('tr');
            headerRow.createEl('th');
            for (const mh of monthHeaders) {
                const th = headerRow.createEl('th', { cls: 'heatmap-month-header' });
                th.setText(mh.label);
                if (mh.colSpan > 1) th.setAttr('colspan', mh.colSpan.toString());
            }

            const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
            for (let day = 0; day < 7; day++) {
                const row = tbody.createEl('tr');
                row.createEl('td', { text: dayNames[day], cls: 'heatmap-day-label' });
                for (const week of weeks) {
                    const dayData = week.days.find(d => d.date.getDay() === day);
                    if (!dayData) {
                        row.createEl('td', { cls: 'heatmap-cell empty' });
                    } else {
                        const ratio = Math.min(dayData.score / dailyGoal, 1.0);
                        const cell = row.createEl('td', { cls: 'heatmap-cell' });
                        if (dayData.score > 0) {
                            cell.style.backgroundColor = this.getHeatmapColor(ratio);
                        } else {
                            cell.style.backgroundColor = this.getEmptyColor();
                        }
                        cell.setAttr('title', `${dayData.date.toLocaleDateString()}: ${dayData.score.toFixed(0)} Punkte`);
                    }
                }
            }
        } else {
            // Gedreht: Spalten = Wochentage, Zeilen = Wochen
            const table = heatmapDiv.createEl('table', { cls: 'heatmap-table rotated' });
            const thead = table.createEl('thead');
            const tbody = table.createEl('tbody');

            const headerRow = thead.createEl('tr');
            headerRow.createEl('th', { text: 'KW', cls: 'heatmap-month-header' });
            const dayNames = ['So','Mo','Di','Mi','Do','Fr','Sa'];
            for (const d of dayNames) {
                headerRow.createEl('th', { text: d, cls: 'heatmap-day-header' });
            }

            for (const week of weeks) {
                const row = tbody.createEl('tr');
                const kw = this.getWeekNumber(week.startDate);
                row.createEl('td', { text: `KW ${kw}`, cls: 'heatmap-month-cell' });

                // Für jeden Wochentag Mo..So prüfen
                for (const dayLabel of dayNames) {
                    const targetDayIndex = dayNames.indexOf(dayLabel); // passt genau, da So=0, Mo=1...
                    const dayData = week.days.find(d => d.date.getDay() === targetDayIndex);
                    if (!dayData) {
                        row.createEl('td', { cls: 'heatmap-cell empty' });
                    } else {
                        const ratio = Math.min(dayData.score / dailyGoal, 1.0);
                        const cell = row.createEl('td', { cls: 'heatmap-cell' });
                        if (dayData.score > 0) {
                            cell.style.backgroundColor = this.getHeatmapColor(ratio);
                        } else {
                            cell.style.backgroundColor = this.getEmptyColor();
                        }
                        cell.setAttr('title', `${dayData.date.toLocaleDateString()}: ${dayData.score.toFixed(0)} Punkte`);
                    }
                }
            }
        }
    }

    private getDailyWeightedScores(weights: { addition: number; deletion: number; revision: number }): Map<string, number> {
        const allCommits = this.plugin.metricsStore.getAllMetrics();
        const map = new Map<string, number>();
        for (const cm of allCommits) {
            const global = cm.files['__global__'];
            if (!global) continue;
            const date = new Date(cm.timestamp * 1000);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const score = global.wordsAdded * weights.addition
                        + global.wordsDeleted * weights.deletion
                        + global.revisionWords * weights.revision;
            const current = map.get(dateKey) || 0;
            map.set(dateKey, current + score);
        }
        return map;
    }

    private formatLocalDateKey(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    private getWeekNumber(d: Date): number {
        const date = new Date(d.getTime());
        date.setHours(0,0,0,0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    private isDarkMode(): boolean {
        return document.body.classList.contains('theme-dark');
    }

    private getHeatmapColor(ratio: number): string {
        // ratio 0..1, dunkles Grün mit steigender Sättigung durch opacity
        const darkMode = this.isDarkMode();
        const r = darkMode ? 57 : 33;
        const g = darkMode ? 211 : 110;
        const b = darkMode ? 83 : 57;
        return `rgba(${r}, ${g}, ${b}, ${ratio})`;
    }

    private getEmptyColor(): string {
        return this.isDarkMode() ? '#2d333b' : '#ebedf0';
    }

    // --- Commit- und Tagesansichten unverändert ---
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
        header.createEl('th', { text: 'Netto' });

        for (const cm of allCommits) {
            const global = cm.files['__global__'];
            if (!global) continue;
            const date = new Date(cm.timestamp * 1000).toLocaleDateString();
            const net = global.wordsAdded - global.wordsDeleted + global.revisionNetWords;
            const row = table.createEl('tr');
            row.createEl('td', { text: date });
            const hashCell = row.createEl('td');
            hashCell.createEl('span', { text: cm.hash.substring(0, 7), cls: 'commit-hash' });
            hashCell.createEl('span', { text: ` ${cm.message}`, cls: 'commit-msg' });
            row.createEl('td', { text: global.wordsAdded.toString() });
            row.createEl('td', { text: global.wordsDeleted.toString() });
            row.createEl('td', { text: global.revisionWords.toString() });
            row.createEl('td', { text: net.toString() });
        }
    }

    private renderDaily(container: HTMLElement) {
        const allCommits = this.plugin.metricsStore.getAllMetrics();
        if (allCommits.length === 0) {
            container.createEl('p', { text: 'Keine Commits analysiert.' });
            return;
        }
        const dailyMap = new Map<string, { added: number; deleted: number; revisionWords: number; revisionNet: number }>();
        for (const cm of allCommits) {
            const global = cm.files['__global__'];
            if (!global) continue;
            const dateKey = new Date(cm.timestamp * 1000).toLocaleDateString();
            const entry = dailyMap.get(dateKey) || { added: 0, deleted: 0, revisionWords: 0, revisionNet: 0 };
            entry.added += global.wordsAdded;
            entry.deleted += global.wordsDeleted;
            entry.revisionWords += global.revisionWords;
            entry.revisionNet += global.revisionNetWords;
            dailyMap.set(dateKey, entry);
        }
        const sortedDays = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

        container.createEl('h4', { text: 'Tägliche Zusammenfassung' });
        const table = container.createEl('table');
        const header = table.createEl('tr');
        header.createEl('th', { text: 'Datum' });
        header.createEl('th', { text: '+ Wörter' });
        header.createEl('th', { text: '- Wörter' });
        header.createEl('th', { text: 'Überarb.' });
        header.createEl('th', { text: 'Netto' });
        header.createEl('th', { text: 'Arbeitsvol.' });

        for (const [date, vals] of sortedDays) {
            const net = vals.added - vals.deleted + vals.revisionNet;
            const gross = vals.added + vals.deleted + vals.revisionWords;
            const row = table.createEl('tr');
            row.createEl('td', { text: date });
            row.createEl('td', { text: vals.added.toString() });
            row.createEl('td', { text: vals.deleted.toString() });
            row.createEl('td', { text: vals.revisionWords.toString() });
            row.createEl('td', { text: net.toString() });
            row.createEl('td', { text: gross.toString() });
        }
    }
}