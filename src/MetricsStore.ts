import { Notice, type Vault } from 'obsidian';
import type { CommitMetrics } from './types';

export class MetricsStore {
    private vault: Vault;
    private pluginDir: string;
    private data: Map<string, CommitMetrics> = new Map();
    private cachePath: string;

    constructor(vault: Vault, pluginDir: string) {
        this.vault = vault;
        this.pluginDir = pluginDir;
        this.cachePath = `${pluginDir}/federstrich-metrics.json`;
    }

    async load(): Promise<void> {
        try {
            const adapter = this.vault.adapter;
            if (await adapter.exists(this.cachePath)) {
                const raw = await adapter.read(this.cachePath);
                const arr: CommitMetrics[] = JSON.parse(raw);
                for (const cm of arr) {
                    this.data.set(cm.hash, cm);
                }
            }
        } catch (e) {
            console.error('Federstrich: Failed to load metrics', e);
            new Notice('Federstrich: Fehler beim Laden der Metriken.');
        }
    }

    async save(): Promise<void> {
        const arr = Array.from(this.data.values());
        const json = JSON.stringify(arr, null, 2);
        await this.vault.adapter.write(this.cachePath, json);
    }

    hasCommit(hash: string): boolean {
        return this.data.has(hash);
    }

    addMetrics(metrics: CommitMetrics): void {
        this.data.set(metrics.hash, metrics);
    }

    getAllMetrics(): CommitMetrics[] {
        return Array.from(this.data.values()).sort((a, b) => b.timestamp - a.timestamp);
    }
}