import { App, PluginSettingTab, Setting } from 'obsidian';
import type FederstrichPlugin from './main';

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

        // Gewichtungen
        containerEl.createEl('h3', { text: 'Gewichtungen für Fortschrittsindex' });

        new Setting(containerEl)
            .setName('Gewichtung: Neue Wörter')
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.plugin.settings.writingIndexWeights.addition)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.writingIndexWeights.addition = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Gewichtung: Gelöschte Wörter')
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.plugin.settings.writingIndexWeights.deletion)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.writingIndexWeights.deletion = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Gewichtung: Überarbeitete Wörter')
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.plugin.settings.writingIndexWeights.revision)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.writingIndexWeights.revision = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Tägliches Ziel (gewichtete Einheiten)')
            .setDesc('Ziel für den gewichteten Fortschrittsindex pro Tag (z. B. 500).')
            .addText(text => text
                .setValue(this.plugin.settings.dailyGoal.toString())
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.dailyGoal = num;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}