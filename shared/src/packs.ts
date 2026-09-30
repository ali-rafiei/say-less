export interface PackInfo {
  id: string;
  name: string;
  blurb: string;
  mature?: boolean;
}

/** Prompt packs the host can mix; `classic` is content/prompts.json, the rest content/packs/<id>.json. */
export const PACKS: readonly PackInfo[] = [
  { id: 'classic', name: 'Classic', blurb: 'The original mix' },
  { id: 'friends', name: 'Group Chat', blurb: 'Every prompt names someone here' },
  { id: 'food', name: 'Food Fight', blurb: 'Snacks, chefs and crimes against dinner' },
  { id: 'work', name: '9 to 5', blurb: 'Bosses, meetings and the office fridge' },
  { id: 'online', name: 'Extremely Online', blurb: 'Phones, apps and group chats' },
  { id: 'movies', name: 'Movie Night', blurb: 'Tropes, sequels and plot holes' },
  { id: 'family', name: 'Family Friendly', blurb: 'Clean enough for grandma' },
  { id: 'afterdark', name: 'After Dark', blurb: 'Cheeky. Adults only.', mature: true },
];

export const DEFAULT_PACKS: readonly string[] = ['classic', 'friends'];

/** Replaced at deal time with the name of someone in the room. */
export const PLAYER_TOKEN = '{player}';
