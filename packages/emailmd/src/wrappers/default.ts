import type { Theme } from '../theme.js';
import type { Segment } from '../segmenter.js';
import type { WrapperMeta } from '../mjml.js';
import { buildHead, segmentsToMjml } from '../mjml.js';

export function defaultWrapper(segments: Segment[], theme: Theme, meta?: WrapperMeta): string {
  const head = buildHead(theme, meta?.preheader, meta?.darkTheme, meta?.dir);
  const body = segmentsToMjml(segments, theme, { strings: meta?.strings, warnings: meta?.warnings, dir: meta?.dir });

  const langAttr = meta?.lang ? ` lang="${meta.lang}"` : '';
  const dirAttr = meta?.dir ? ` dir="${meta.dir}"` : '';

  return `<mjml${langAttr}${dirAttr}>
  ${head}
  <mj-body css-class="emd-root" background-color="${theme.backgroundColor}" width="${theme.contentWidth}">
    ${body}
  </mj-body>
</mjml>`;
}
