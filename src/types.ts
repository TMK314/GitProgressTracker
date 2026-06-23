export interface DiffBlock {
    type: 'addition' | 'deletion' | 'revision';
    oldLines: string[];
    newLines: string[];
}

export interface CommitMetrics {
    hash: string;
    timestamp: number; // Unix seconds
    message: string;
    files: {
        [filePath: string]: {
            additions: number;
            deletions: number;
            revisions: number;
            wordsAdded: number;
            wordsDeleted: number;
            wordsOldRevised: number;
            wordsNewRevised: number;
        };
    };
}

export interface AggregatedMetrics {
    totalWordsAdded: number;
    totalWordsDeleted: number;
    totalWordsOldRevised: number;
    totalWordsNewRevised: number;
    netWords: number;
    grossWork: number;
    pureRevision: number;
}

export interface FederstrichSettings {
    repoPath: string;
    authorFilter: string;
    includePattern: string;          // NEU
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
    includePattern: '**/*.md',       // NEU – Standard: nur Markdown
    wordSeparatorRegex: '[\\s\\-–—.,;:!?»«“”\'\"\\[\\]\\(\\)]+',
    maxRevisionDistance: 0,
    writingIndexWeights: { addition: 1, deletion: 0.5, revision: 1.2 }
};