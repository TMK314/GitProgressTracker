# Git Progress Tracker – Git-based Progress Tracking for Your Writing Projects

Track your writing progress across all phases of your project – from the first draft to final revisions. Unlike simple word‑count trackers, **Git Progress Tracker** analyses your Git commits to distinguish between *new writing*, *deletions*, and *revisions*, giving you a realistic picture of the work you’ve actually done.

---
## Features

- **True revision detection** – By comparing word‑frequency changes in each commit, Git Progress Tracker knows when you’re rewriting existing text rather than just adding or removing words.
- **Levenshtein‑based word‑level diff** – Revisions are measured precisely: replacing one word with another counts as *one* change, not two.
- **Rich progress metrics**
  - Net word difference
  - Gross work volume (all words touched)
  - Pure revision effort
- **Git‑Hub–style heatmap** – A clean, scrollable heatmap shows your daily progress over the project’s lifetime. Hover to see exact scores.
- **Three views**
  1. **Overview** – Heatmap + aggregated totals
  2. **By Commit** – Per‑commit breakdown
  3. **By Day** – Daily summaries, sorted chronologically
- **Customisable weighting** – Assign different weights to new words, deleted words, and revised words to match your personal definition of “progress”.
- **Automatic daily goal tracking** – Set a target for your weighted progress; the heatmap colours show how close you came each day.
- **Flexible file filtering** – Include only the files you care about (e.g. `**/*.md`) using glob patterns.
- **Author filter** – Count only your own commits in shared repositories.
- **Dark & Light mode** – Colours adapt automatically to Obsidian’s theme.

---

## Requirements

- Your Obsidian vault must be a **Git repository** (or a subfolder of one).  
  The plugin does not manage Git itself – use your favourite Git client (CLI, GitHub Desktop, etc.).
- Git must be installed and available in your PATH.
- It is recommended to write each sentence on a separate line so that the plugin can work effectively.

---

## Installation

### From Obsidian Community Plugins (coming soon)

1. Open **Settings → Community Plugins**.
2. Disable **Safe mode** if necessary.
3. Click **Browse** and search for “Git Revision Tracker”.
4. Install and enable the plugin.

### Manual installation

1. Download the latest release from [GitHub Releases](https://github.com/TMK314/GitProgressTracker/releases).
2. Extract the folder into `<vault>/.obsidian/plugins/git-revision-tracker/`.
3. Reload Obsidian.
4. Enable the plugin under **Settings → Community Plugins → Installed Plugins**.

---

## Getting Started

1. **Enable the plugin** and open the settings to configure your preferences.
2. Click the **feather icon** in the ribbon (or use the command “Git Progress Tracker: Update Progress”) to analyse your Git history.
3. Open the **Progress View** via the ribbon icon or the command palette.
4. Explore the three tabs:
   - **Overview** – Heatmap and total statistics.
   - **By Commit** – See what changed in each commit.
   - **By Day** – Daily aggregated numbers.
5. Use the **“Rotate view”** button to swap the axes of the heatmap.
6. Adjust the **weighting** and **daily goal** in the settings until the progress numbers feel right to you.

---

## Settings

| Setting | Description | Default |
|--------|-------------|---------|
| Repository path | Relative path inside the vault where your Git repository lives. Leave empty for the vault root. | *(empty)* |
| Author filter | Only analyse commits by this Git author (leave blank for all). | *(empty)* |
| Include files (glob) | Glob pattern for files to analyse. | `**/*.md` |
| Word separator (regex) | Regular expression used to split words. | `[\s\-–—.,;:!?»«“”'"\[\]()]+` |
| Max context lines for revision | How many unchanged lines may appear between a deletion and an addition for them to still be considered a revision. | 0 |
| Weight: New words | Weight for added words. | 1.0 |
| Weight: Deleted words | Weight for deleted words. | 0.5 |
| Weight: Revised words | Weight for words changed during revision. | 1.2 |
| Daily goal | Target points per day (based on the weighted values). | 500 |

---

## Metrics explained

| Metric | Formula / Meaning |
|--------|------------------|
| **Net word difference** | `wordsAdded − wordsDeleted + revisionNetWords` – The net effect on your manuscript’s size. |
| **Gross work volume** | `wordsAdded + wordsDeleted + revisionWords` – Every word you touched. |
| **Pure revision effort** | `revisionWords` – Words that were both removed and added in revisions. |
| **New words** | Words added without any corresponding deletion. |
| **Deleted words** | Words removed without replacement. |
| **Revision net change** | `revisionNewWords − revisionOldWords` – Net change caused by revisions. |

---

## How revision detection works

1. Git Progress Tracker pulls the unified diff for each commit.
2. Within each file, consecutive blocks of deleted (`-`) and added (`+`) lines that are not separated by context lines are paired as **revisions**.
3. For each revision block, the plugin tokenises the old and new lines into words.
4. It then calculates the **Levenshtein distance** on the word level, treating word substitution as a single change.
5. The result is stored as `revisionWords` (the number of individual word changes) and `revisionNetWords` (the net difference in word count).

This means that if you change *three words in a 19‑word sentence*, the plugin counts **three** revisions, not 38.
