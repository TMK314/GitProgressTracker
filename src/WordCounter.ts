export class WordCounter {
    private separator: RegExp;

    constructor(separatorRegex: string) {
        this.separator = new RegExp(separatorRegex, 'g');
    }

    countWords(text: string): number {
        const cleanText = this.sanitizeMarkdownLinks(text);
        if (!cleanText.trim()) return 0;
        const words = cleanText.trim().split(this.separator).filter(w => w.length > 0);
        return words.length;
    }

    countWordsInLines(lines: string[]): number {
        return lines.reduce((sum, line) => sum + this.countWords(line), 0);
    }

    tokenizeLines(lines: string[]): string[] {
        const words: string[] = [];
        for (const line of lines) {
            const cleanLine = this.sanitizeMarkdownLinks(line);
            if (!cleanLine.trim()) continue;
            const tokens = cleanLine.trim().split(this.separator).filter(w => w.length > 0);
            words.push(...tokens);
        }
        return words;
    }

    /**
     * Ersetzt Markdown-Links durch ihren reinen Textinhalt.
     * - Wikilinks: [[target|alias]] → alias (oder target, wenn kein alias)
     * - Normale Links: [text](url) → text
     */
    private sanitizeMarkdownLinks(text: string): string {
        // Wikilinks mit Alias: [[target|alias]] → alias
        text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1');
        // Wikilinks ohne Alias: [[target]] → target
        text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
        // Normale Links: [text](url) → text
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        return text;
    }
}