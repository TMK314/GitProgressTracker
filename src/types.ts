export interface DiffBlock {
    type: 'addition' | 'deletion' | 'revision';
    oldLines: string[];
    newLines: string[];
}

export interface FileMetrics {
    additions: number;
    deletions: number;
    revisions: number;          // Anzahl der Revisionsblöcke
    wordsAdded: number;
    wordsDeleted: number;
    revisionWords: number;      // Bearbeitete Wörter (Häufigkeitsvergleich)
    revisionNetWords: number;   // Netto-Wortänderung durch Revisionen
}

export interface CommitMetrics {
    hash: string;
    timestamp: number;          // Unix seconds
    message: string;
    files: {
        [filePath: string]: FileMetrics;
    };
}

export interface AggregatedMetrics {
    totalWordsAdded: number;
    totalWordsDeleted: number;
    totalRevisionWords: number;      // Summe der bearbeiteten Wörter
    totalRevisionNetWords: number;   // Summe der Netto-Änderungen durch Revisionen
    netWords: number;                // totalWordsAdded - totalWordsDeleted + totalRevisionNetWords
    grossWork: number;               // totalWordsAdded + totalWordsDeleted + totalRevisionWords
    pureRevision: number;            // = totalRevisionWords
}

export interface FederstrichSettings {
    repoPath: string;
    authorFilter: string;
    includePattern: string;
    wordSeparatorRegex: string;
    maxRevisionDistance: number;
    writingIndexWeights: {
        addition: number;
        deletion: number;
        revision: number;
    };
}

export const DEFAULT_SETTINGS: FederstrichSettings = {
    repoPath: '',
    authorFilter: '',
    includePattern: '**/*.md',
    wordSeparatorRegex: '[\\s\\-–—.,;:!?»«“”\'\"\\[\\]\\(\\)]+',
    maxRevisionDistance: 0,
    writingIndexWeights: { addition: 1, deletion: 0.5, revision: 1.2 }
};