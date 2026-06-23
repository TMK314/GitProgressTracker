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
}