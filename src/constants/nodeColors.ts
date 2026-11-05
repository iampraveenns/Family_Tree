/**
 * Node Color Theme Palettes for Genealogy Member Nodes
 * Features soft pastel palettes with high-readability text.
 * The default yellow palette is a soft, pale butter-yellow pastel (#FFF8D6)
 * matching the low-contrast pastel aesthetic of the other variants.
 */

export interface NodeColorPalette {
  id: string;
  name: string;
  background: string;
  border: string;
  text: string;
  accent: string;
  dot: string;
  chipBg: string;
}

export const NODE_COLOR_PALETTES: Record<string, NodeColorPalette> = {
  yellow: {
    id: 'yellow',
    name: 'Butter Yellow',
    background: '#FFF8D6',
    border: '#F5E7A3',
    text: '#263449',
    accent: '#D4B83E',
    dot: '#F5E7A3',
    chipBg: '#FEF9C3',
  },
  blue: {
    id: 'blue',
    name: 'Pastel Blue',
    background: '#E0F2FE',
    border: '#BAE6FD',
    text: '#0C4A6E',
    accent: '#0284C7',
    dot: '#BAE6FD',
    chipBg: '#E0F2FE',
  },
  green: {
    id: 'green',
    name: 'Pastel Mint',
    background: '#ECFDF5',
    border: '#A7F3D0',
    text: '#064E3B',
    accent: '#059669',
    dot: '#A7F3D0',
    chipBg: '#D1FAE5',
  },
  rose: {
    id: 'rose',
    name: 'Pastel Rose',
    background: '#FFF1F2',
    border: '#FECDD3',
    text: '#881337',
    accent: '#E11D48',
    dot: '#FECDD3',
    chipBg: '#FFE4E6',
  },
  purple: {
    id: 'purple',
    name: 'Pastel Lavender',
    background: '#F3E8FF',
    border: '#DDD6FE',
    text: '#581C87',
    accent: '#8B5CF6',
    dot: '#DDD6FE',
    chipBg: '#EDE9FE',
  },
  peach: {
    id: 'peach',
    name: 'Pastel Peach',
    background: '#FFF7ED',
    border: '#FED7AA',
    text: '#7C2D12',
    accent: '#EA580C',
    dot: '#FED7AA',
    chipBg: '#FFEDD5',
  },
  teal: {
    id: 'teal',
    name: 'Pastel Teal',
    background: '#F0FDFA',
    border: '#99F6E4',
    text: '#134E4A',
    accent: '#0D9488',
    dot: '#99F6E4',
    chipBg: '#CCFBF1',
  },
  slate: {
    id: 'slate',
    name: 'Pastel Slate',
    background: '#F8FAFC',
    border: '#E2E8F0',
    text: '#1E293B',
    accent: '#64748B',
    dot: '#CBD5E1',
    chipBg: '#F1F5F9',
  },
};

export const BUTTER_YELLOW_COLOR = NODE_COLOR_PALETTES.yellow;

export const DEFAULT_NODE_COLOR = NODE_COLOR_PALETTES.yellow;

export const ALL_NODE_COLOR_PALETTES = Object.values(NODE_COLOR_PALETTES);

/**
 * Resolves a palette by color key, defaulting to the soft butter-yellow pastel palette.
 */
export function getNodeColorPalette(colorKey?: string | null): NodeColorPalette {
  if (!colorKey) return DEFAULT_NODE_COLOR;
  const key = colorKey.toLowerCase().trim();
  return NODE_COLOR_PALETTES[key] || DEFAULT_NODE_COLOR;
}
