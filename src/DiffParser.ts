import { minimatch } from 'minimatch';
import type { DiffBlock } from './types';

export class DiffParser {
    private maxRevisionDistance: number;
    private includePattern: string;

    constructor(maxRevisionDistance: number, includePattern: string) {
        this.maxRevisionDistance = maxRevisionDistance;
        this.includePattern = includePattern;
    }

    parse(diffText: string): DiffBlock[] {
        const allBlocks: DiffBlock[] = [];
        const lines = diffText.split('\n');
        let i = 0;

        while (i < lines.length) {
            // Nächsten Datei-Header finden
            if (lines[i] !== undefined)
            if (lines[i]!.startsWith('diff --git ')) {
                const filePath = this.extractFilePath(lines[i]!);
                const included = minimatch(filePath, this.includePattern);

                // Alle Zeilen dieser Datei bis zum nächsten diff --git sammeln
                const fileLines: string[] = [];
                i++; // eine Zeile weiter
                while (i < lines.length && !lines[i]!.startsWith('diff --git ')) {
                    fileLines.push(lines[i]!);
                    i++;
                }

                if (included) {
                    // Nur für passende Dateien die Blöcke analysieren
                    const blocks = this.parseFileBlocks(fileLines);
                    allBlocks.push(...blocks);
                }
            } else {
                i++;
            }
        }
        return allBlocks;
    }

    private extractFilePath(diffHeaderLine: string): string {
        // diff --git a/path/file b/path/file
        const parts = diffHeaderLine.split(' b/');
        if (parts.length > 1 && parts[1] !== undefined) {
            return parts[1].trim();
        }
        // Fallback: verwende komplette Zeile (sollte nicht vorkommen)
        return diffHeaderLine;
    }

    /**
     * Parst die Hunks innerhalb einer einzelnen Datei (ohne den diff --git Header)
     */
    private parseFileBlocks(fileLines: string[]): DiffBlock[] {
        const blocks: DiffBlock[] = [];
        let currentDeletion: string[] = [];
        let currentAddition: string[] = [];
        let contextCounter = 0;
        let state: 'context' | 'deletion' | 'addition' = 'context';

        const flush = () => {
            if (currentDeletion.length > 0 && currentAddition.length > 0) {
                blocks.push({
                    type: 'revision',
                    oldLines: [...currentDeletion],
                    newLines: [...currentAddition]
                });
            } else if (currentDeletion.length > 0) {
                blocks.push({
                    type: 'deletion',
                    oldLines: [...currentDeletion],
                    newLines: []
                });
            } else if (currentAddition.length > 0) {
                blocks.push({
                    type: 'addition',
                    oldLines: [],
                    newLines: [...currentAddition]
                });
            }
            currentDeletion = [];
            currentAddition = [];
            contextCounter = 0;
            state = 'context';
        };

        for (const rawLine of fileLines) {
            // Ignoriere Datei-Index und --- / +++ Zeilen (kommen innerhalb einer Datei nicht mehr vor,
            // aber sicherheitshalber behandeln)
            if (rawLine.startsWith('index ') || rawLine.startsWith('--- ') || rawLine.startsWith('+++ ')) {
                continue;
            }

            if (rawLine.startsWith('@@')) {
                flush();
                continue;
            }

            const line = rawLine.substring(1);
            const prefix = rawLine[0];

            if (prefix === ' ') {
                // Kontextzeile
                if (state === 'addition' && currentAddition.length > 0 && currentDeletion.length === 0) {
                    // reine Addition endet
                    flush();
                } else if (state === 'deletion' && currentDeletion.length > 0 && currentAddition.length === 0) {
                    contextCounter++;
                    // Wenn maximale Distanz überschritten, Pairing aufgeben
                    if (contextCounter > this.maxRevisionDistance) {
                        flush();
                    }
                } else {
                    flush();
                }
                state = 'context';
            } else if (prefix === '-') {
                if (state === 'addition' && currentAddition.length > 0 && currentDeletion.length === 0) {
                    flush();
                }
                currentDeletion.push(line);
                state = 'deletion';
                contextCounter = 0;
            } else if (prefix === '+') {
                currentAddition.push(line);
                state = 'addition';
            }
        }

        flush();
        return blocks;
    }
}