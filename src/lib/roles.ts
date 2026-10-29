export const ROLES = ['admin', 'master', 'player'] as const;
export type Role = (typeof ROLES)[number];

export const VISIBILITIES = ['public', 'players', 'master', 'personal'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const TAG_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;
export type TagColor = (typeof TAG_COLORS)[number];
