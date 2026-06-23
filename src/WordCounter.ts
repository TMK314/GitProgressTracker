export class WordCounter {
    private separator: RegExp;

    constructor(separatorRegex: string) {
        this.separator = new RegExp(separatorRegex, 'g');
    }

    countWords(text: string): number {
        if (!text.trim()) return 0;
        const words = text.trim().split(this.separator).filter(w => w.length > 0);
        return words.length;
    }

    countWordsInLines(lines: string[]): number {
        return lines.reduce((sum, line) => sum + this.countWords(line), 0);
    }

    /**
     * Zerlegt eine Liste von Zeilen in ein flaches Array von Wörtern.
     */
    tokenizeLines(lines: string[]): string[] {
        const words: string[] = [];
        for (const line of lines) {
            if (!line.trim()) continue;
            const tokens = line.trim().split(this.separator).filter(w => w.length > 0);
            words.push(...tokens);
        }
        return words;
    }
}