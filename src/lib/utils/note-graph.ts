export type NoteGraphEdgeType = 'wiki' | 'semantic';

export type PublishedGraphNode = {
  slug: string;
  title: string;
  category: string | null;
};

export type PublishedGraphEdge = {
  source: string;
  target: string;
  type: NoteGraphEdgeType;
};

export type PublishedNoteGraph = {
  nodes: PublishedGraphNode[];
  edges: PublishedGraphEdge[];
};
