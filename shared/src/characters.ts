export interface CharacterMeta {
  id: string;
  name: string;
  flavor: string;
  /** dominant fill, used for name chips and vote bars */
  accent: string;
}

export const CHARACTERS: readonly CharacterMeta[] = [
  {
    id: 'bigfoot',
    name: 'Bigfoot',
    flavor: 'Small round sunglasses; a cool, camera-shy celebrity',
    accent: '#E9B24A',
  },
  {
    id: 'yeti',
    name: 'Yeti',
    flavor: 'Long yellow scarf; warm, cosy, gives the best hugs',
    accent: '#FFFAF0',
  },
  {
    id: 'nessie',
    name: 'Nessie',
    flavor: 'Long S-curved neck; a playful poser who loves a photo',
    accent: '#26D0C1',
  },
  {
    id: 'mothman',
    name: 'Mothman',
    flavor: 'Carries a little table lamp; gentle, dreamy, devoted to it',
    accent: '#0F73FC',
  },
  {
    id: 'jackalope',
    name: 'Jackalope',
    flavor: 'Antlers and a teal bandana; hyper, fast and proud',
    accent: '#FDE22A',
  },
  {
    id: 'kraken',
    name: 'Kraken',
    flavor: "A stolen captain's hat; a confident multitasker",
    accent: '#F95C3C',
  },
  {
    id: 'kappa',
    name: 'Kappa',
    flavor: 'Water dish on its head; polite, careful, never spills a drop',
    accent: '#4DE598',
  },
  {
    id: 'alien',
    name: 'Alien',
    flavor: 'Tourist camera; wide-eyed and delighted by everything',
    accent: '#C8FC37',
  },
  {
    id: 'ghost',
    name: 'Ghost',
    flavor: 'Bedsheet with a wavy hem; a giggly prankster',
    accent: '#6AE3FD',
  },
  {
    id: 'chupacabra',
    name: 'Chupacabra',
    flavor: 'Spines rise with its mood; small, fearless, all bark',
    accent: '#FB9C41',
  },
  {
    id: 'flatwoods',
    name: 'Flatwoods',
    flavor: 'Tall spade-shaped hood; grand, theatrical, loves an entrance',
    accent: '#FC9207',
  },
  {
    id: 'werewolf',
    name: 'Werewolf',
    flavor: 'Bushy tail; a big fluffy softie who howls along to it all',
    accent: '#C1C6F3',
  },
  {
    id: 'vampire',
    name: 'Vampire',
    flavor: 'High-collared cape; a dramatic, old-fashioned charmer',
    accent: '#E23A25',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    flavor: 'Red bow tie; a cheerful, rattly show-off dancer',
    accent: '#FEFDE2',
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    flavor: 'Flame crest and tail; an unstoppable optimist',
    accent: '#FDCA15',
  },
  {
    id: 'unicorn',
    name: 'Unicorn',
    flavor: 'Gold spiral horn; sweet, wholesome, easily scandalised',
    accent: '#A195F4',
  },
  {
    id: 'gargoyle',
    name: 'Gargoyle',
    flavor: 'Stone wings and statue stillness; a loyal, watchful guardian',
    accent: '#7BA3BE',
  },
  {
    id: 'cerberus',
    name: 'Cerberus',
    flavor: 'Three heads, spiked collars, three moods that never agree',
    accent: '#AE5226',
  },
];

export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);

export function characterMeta(id: string | null | undefined): CharacterMeta | null {
  if (!id) return null;
  return CHARACTERS.find((c) => c.id === id) ?? null;
}
