export interface CharacterMeta {
  id: string;
  name: string;
  flavor: string;
  /** dominant fill, used for name chips and vote bars */
  accent: string;
}

export const CHARACTERS: readonly CharacterMeta[] = [
  { id: 'lemon', name: 'Smug Lemon', flavor: 'Perpetually unimpressed citrus', accent: '#F9D423' },
  { id: 'raccoon', name: 'Raccoon in a Tie', flavor: 'Corporate trash panda', accent: '#8E9AAF' },
  {
    id: 'icecream',
    name: 'Melting Ice Cream',
    flavor: 'Anxious, always slightly dripping',
    accent: '#FF8FB1',
  },
  {
    id: 'grandma',
    name: 'Judgmental Grandma',
    flavor: 'Glasses slide down for lose state',
    accent: '#B983FF',
  },
  { id: 'sock', name: 'Sock Puppet', flavor: 'Googly eyes, no other face', accent: '#4ECDC4' },
  {
    id: 'cactus',
    name: 'Huggable Cactus',
    flavor: "Wants affection, can't have it",
    accent: '#6BCB77',
  },
  { id: 'toast', name: 'Burnt Toast', flavor: 'Deadpan, slightly smoking', accent: '#C68B59' },
  { id: 'pigeon', name: 'City Pigeon', flavor: 'Head-bobs constantly in idle', accent: '#7B8CDE' },
  { id: 'ghost', name: 'Shy Ghost', flavor: 'Fades to 60% opacity when losing', accent: '#E8ECFF' },
  { id: 'blob', name: 'The Blob', flavor: 'Pure squash-and-stretch', accent: '#2EC4B6' },
];

export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);

export function characterMeta(id: string | null | undefined): CharacterMeta | null {
  if (!id) return null;
  return CHARACTERS.find((c) => c.id === id) ?? null;
}
