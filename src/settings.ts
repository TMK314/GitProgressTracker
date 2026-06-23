import { App, PluginSettingTab, Setting } from 'obsidian';
import type FederstrichPlugin from './main';
import { DEFAULT_SETTINGS } from './types';

export class FederstrichSettingTab extends PluginSettingTab {
    plugin: FederstrichPlugin;

    constructor(app: App, plugin: FederstrichPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Federstrich Einstellungen' });

        new Setting(containerEl)
            .setName('Repository-Pfad')
            .setDesc('Relativer Pfad innerhalb des Vaults, der das Git-Repo enthält. Leer = Vault-Root.')
            .addText(text => text
                .setPlaceholder('/')
                .setValue(this.plugin.settings.repoPath)
                .onChange(async (value) => {
                    this.plugin.settings.repoPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Autor-Filter')
            .setDesc('Nur Commits dieses Autors berücksichtigen. Leer lassen für alle.')
            .addText(text => text
                .setValue(this.plugin.settings.authorFilter)
                .onChange(async (value) => {
                    this.plugin.settings.authorFilter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Dateien einschließen (Glob)')
            .setDesc('Nur Dateien, die diesem Glob-Muster entsprechen, werden analysiert. Standard: **/*.md')
            .addText(text => text
                .setPlaceholder('**/*.md')
                .setValue(this.plugin.settings.includePattern)
                .onChange(async (value) => {
                    this.plugin.settings.includePattern = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Wort-Trennzeichen (Regex)')
            .setDesc('Regulärer Ausdruck, um Wörter zu trennen.')
            .addText(text => text
                .setValue(this.plugin.settings.wordSeparatorRegex)
                .onChange(async (value) => {
                    this.plugin.settings.wordSeparatorRegex = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max. Kontextzeilen für Überarbeitung')
            .setDesc('Wieviele Kontextzeilen zwischen Löschung und Einfügung liegen dürfen, um noch als Überarbeitung (Revision) zu gelten.')
            .addSlider(slider => slider
                .setLimits(0, 5, 1)
                .setValue(this.plugin.settings.maxRevisionDistance)
                .onChange(async (value) => {
                    this.plugin.settings.maxRevisionDistance = value;
                    await this.plugin.saveSettings();
                }));
    }
}