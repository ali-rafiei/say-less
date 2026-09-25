export interface CharacterMeta {
  id: string;
  name: string;
  flavor: string;
  /** dominant fill, used for name chips and vote bars */
  accent: string;
}

export const CHARACTERS: readonly CharacterMeta[] = [
  {
    id: 'cat',
    name: 'Cat',
    flavor: 'Half-lidded and unimpressed; the tail never stops',
    accent: '#EEA373',
  },
  {
    id: 'monkey',
    name: 'Monkey',
    flavor: 'Cupped ears, looping tail, up to something',
    accent: '#9B6B45',
  },
  {
    id: 'duck',
    name: 'Duck',
    flavor: 'Sleepy eyes, one cowlick and a red neckerchief',
    accent: '#F1C753',
  },
  {
    id: 'bird',
    name: 'Bird',
    flavor: 'Zigzag vest; head-bobs constantly in idle',
    accent: '#5F7FB4',
  },
  {
    id: 'axolotl',
    name: 'Axolotl',
    flavor: 'Coral gills sway; droop when losing',
    accent: '#F0B3BD',
  },
  {
    id: 'bear',
    name: 'Bear',
    flavor: 'Biggest silhouette in the room, gentle eyebrows',
    accent: '#8C6444',
  },
  {
    id: 'rabbit',
    name: 'Rabbit',
    flavor: 'Long ears, one tilted; they flop when losing',
    accent: '#F1E6D2',
  },
  {
    id: 'fish',
    name: 'Fish',
    flavor: 'Puckered lips, mustard vest, blows bubbles',
    accent: '#6FC0B4',
  },
  {
    id: 'blob',
    name: 'Blob',
    flavor: 'Pure squash-and-stretch; puddles when losing',
    accent: '#A8D1B8',
  },
  {
    id: 'otter',
    name: 'Otter',
    flavor: 'Holds its own paws; floats off when losing',
    accent: '#B08968',
  },
  {
    id: 'penguin',
    name: 'Penguin',
    flavor: 'No neck, tiny flippers, formal at all times',
    accent: '#555D83',
  },
  {
    id: 'hedgehog',
    name: 'Hedgehog',
    flavor: 'Blunt spikes and a leaf; curls up when losing',
    accent: '#8C7265',
  },
];

export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);

export function characterMeta(id: string | null | undefined): CharacterMeta | null {
  if (!id) return null;
  return CHARACTERS.find((c) => c.id === id) ?? null;
}
