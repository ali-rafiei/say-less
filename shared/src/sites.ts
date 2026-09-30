/**
 * Out of Context (after Jackbox's Survive the Internet): the fake website a quote gets
 * posted on. The twister sees only the quote and writes the `twist` for it.
 */
export type SiteId =
  'news' | 'social' | 'fundraiser' | 'checkin' | 'shop' | 'video' | 'forum' | 'jobs';

export interface Site {
  id: SiteId;
  /** shown as the post's badge */
  name: string;
  /** the twister's instruction */
  instruction: string;
  /** what the quote is, under the twist */
  quoteLabel: string;
}

export const SITES: Record<SiteId, Site> = {
  news: {
    id: 'news',
    name: 'News',
    instruction: 'Write the news headline this comment was left under.',
    quoteLabel: 'Top comment',
  },
  social: {
    id: 'social',
    name: 'Social',
    instruction: 'Write the post this was a reply to.',
    quoteLabel: 'Reply',
  },
  fundraiser: {
    id: 'fundraiser',
    name: 'Fundraiser',
    instruction: 'Name the fundraiser this donor comment is on.',
    quoteLabel: 'Donor comment',
  },
  checkin: {
    id: 'checkin',
    name: 'Check-in',
    instruction: 'Name the place they checked in at.',
    quoteLabel: 'Checked in and said',
  },
  shop: {
    id: 'shop',
    name: 'Shop',
    instruction: 'Name the product this review is for.',
    quoteLabel: 'Five-star review',
  },
  video: {
    id: 'video',
    name: 'Video',
    instruction: 'Title the video this comment is under.',
    quoteLabel: 'Pinned comment',
  },
  forum: {
    id: 'forum',
    name: 'Forum',
    instruction: 'Write the forum thread title this answers.',
    quoteLabel: 'Best answer',
  },
  jobs: {
    id: 'jobs',
    name: 'Jobs',
    instruction: 'Name who or what this glowing reference is for.',
    quoteLabel: 'Reference',
  },
};

export const SITE_IDS = Object.keys(SITES) as SiteId[];
