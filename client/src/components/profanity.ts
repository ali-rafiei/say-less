import {
  RegExpMatcher,
  TextCensor,
  asteriskCensorStrategy,
  englishDataset,
  englishRecommendedTransformers,
  keepStartCensorStrategy,
} from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
const censor = new TextCensor().setStrategy(keepStartCensorStrategy(asteriskCensorStrategy()));

/** Display-only masking; submissions are never blocked. */
export function maskProfanity(text: string): string {
  return censor.applyTo(text, matcher.getAllMatches(text));
}
