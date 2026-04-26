export const CATEGORIES = [
  'engineering',
  'architecture',
  'devops',
  'databases',
  'frontend',
  'backend',
  'testing',
  'process',
  'leadership',
  'career',
  'tooling',
  'security',
] as const;

export type Category = (typeof CATEGORIES)[number];
