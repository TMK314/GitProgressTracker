import { App, PluginSettingTab, Setting } from 'obsidian';
import type GitProgressTrackerPlugin from './main';

export class GitProgressTrackerSettingTab extends PluginSettingTab {
    plugin: GitProgressTrackerPlugin;

    constructor(app: App, plugin: GitProgressTrackerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'GitProgressTracker Settings' });

        new Setting(containerEl)
            .setName('Repository-Path')
            .setDesc('Relative Path inside the Vaults that contains the Git-Repo. Leave empty for Vault-Root.')
            .addText(text => text
                .setPlaceholder('/')
                .setValue(this.plugin.settings.repoPath)
                .onChange(async (value) => {
                    this.plugin.settings.repoPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Author-Filter')
            .setDesc('Only consider commits by this author. Leave empty for all.')
            .addText(text => text
                .setValue(this.plugin.settings.authorFilter)
                .onChange(async (value) => {
                    this.plugin.settings.authorFilter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Files (Glob)')
            .setDesc('Only consider files that match this glob pattern. Default: **/*.md')
            .addText(text => text
                .setPlaceholder('**/*.md')
                .setValue(this.plugin.settings.includePattern)
                .onChange(async (value) => {
                    this.plugin.settings.includePattern = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Word Separator (Regex)')
            .setDesc('Regular expression to split words.')
            .addText(text => text
                .setValue(this.plugin.settings.wordSeparatorRegex)
                .onChange(async (value) => {
                    this.plugin.settings.wordSeparatorRegex = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Minimum word similarity for revision')
            .setDesc('Jaccard index (0–1). Deleted and new lines are counted as a revision only if they reach this degree of similarity. 0 = always pair; 1 = only with identical sets of words.')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.05)
                .setValue(this.plugin.settings.revisionSimilarityThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.revisionSimilarityThreshold = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max. context lines for revision')
            .setDesc('How many lines of context are permitted between a deletion and an insertion for it to still count as a revision.')
            .addSlider(slider => slider
                .setLimits(0, 5, 1)
                .setValue(this.plugin.settings.maxRevisionDistance)
                .onChange(async (value) => {
                    this.plugin.settings.maxRevisionDistance = value;
                    await this.plugin.saveSettings();
                }));

        // Gewichtungen
        containerEl.createEl('h3', { text: 'Progress Index Weights' });

        new Setting(containerEl)
            .setName('Weight: New Words')
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.plugin.settings.writingIndexWeights.addition)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.writingIndexWeights.addition = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Weight: Deleted Words')
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.plugin.settings.writingIndexWeights.deletion)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.writingIndexWeights.deletion = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Weight: Revised Words')
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.plugin.settings.writingIndexWeights.revision)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.writingIndexWeights.revision = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Daily Goal (Weighted Units)')
            .setDesc('Target for the weighted progress index per day (e.g., 500).')
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