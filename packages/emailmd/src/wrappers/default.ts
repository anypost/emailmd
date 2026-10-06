import type { Theme } from '../theme.js';
import type { Segment } from '../segmenter.js';
import type { WrapperMeta } from '../mjml.js';
import { buildDocument, segmentsToMjml } from '../mjml.js';

export function defaultWrapper(segments: Segment[], theme: Theme, meta?: WrapperMeta): string {
  return buildDocument(segmentsToMjml(segments, theme, meta), theme, meta);
}
