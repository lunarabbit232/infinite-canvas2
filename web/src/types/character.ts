export type CharacterColorScheme = {
    primary: string;
    accent: string;
    accent2?: string;
};

export type Character = {
    id: string;
    userId: string;
    name: string;
    description: string;
    personalityKeywords: string[];
    colorScheme?: CharacterColorScheme;
    coverUrl: string;
    referenceUrls: string[];
    promptTemplate: string;
    voiceUrl: string;
    sceneUrls: string[];
    createdAt: string;
    updatedAt: string;
};
