export interface DiffBlock {
    type: 'addition' | 'deletion' | 'revision';
    oldLines: string[];
    newLines: string[];
}

export interface FileMetrics {
    additions: number;
    deletions: number;
    revisions: number;
    wordsAdded: number;
    wordsDeleted: number;
    revisionWords: number;
    revisionNetWords: number;
}

export interface CommitMetrics {
    hash: string;
    timestamp: number;
    message: string;
    files: {
        [filePath: string]: FileMetrics;
    };
}

export interface AggregatedMetrics {
    totalWordsAdded: number;
    totalWordsDeleted: number;
    totalRevisionWords: number;
    totalRevisionNetWords: number;
    netWords: number;
    grossWork: number;
    pureRevision: number;
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
    dailyGoal: number;                // NEU
}

export const DEFAULT_SETTINGS: FederstrichSettings = {
    repoPath: '',
    authorFilter: '',
    includePattern: '**/*.md',
    wordSeparatorRegex: '[\\s\\-–—.,;:!?»«“”\'\"\\[\\]\\(\\)]+',
    maxRevisionDistance: 0,
    writingIndexWeights: { addition: 1, deletion: 0.5, revision: 1.2 },
    dailyGoal: 500                    // NEU
};