export const ROLES = ['admin', 'master', 'player'] as const;
export type Role = (typeof ROLES)[number];

export const VISIBILITIES = ['public', 'players', 'master', 'personal'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const TAG_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/** Visibilità che si possono dare a un singolo blocco di una pagina (vedi content/blocks.ts): per ora il segreto del Master. */
export const BLOCK_VISIBILITIES: readonly Visibility[] = ['master'];
