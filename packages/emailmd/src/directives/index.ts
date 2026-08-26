import type MarkdownIt from 'markdown-it';
import { registerCallout } from './callout.js';
import { registerCentered } from './centered.js';
import { registerHighlight } from './highlight.js';
import { registerHeader } from './header.js';
import { registerFooter } from './footer.js';
import { registerHero } from './hero.js';
import { registerColumns } from './columns.js';
import { registerSpacer } from './spacer.js';
import { registerDivider } from './divider.js';
import { registerSocial } from './social.js';
import { registerAccordion } from './accordion.js';
import { registerChart } from './chart.js';
import { registerProgress } from './progress.js';
import { registerSparkline } from './sparkline.js';

export function registerDirectives(md: MarkdownIt): void {
  registerCallout(md);
  registerCentered(md);
  registerHighlight(md);
  registerHeader(md);
  registerFooter(md);
  registerHero(md);
  registerColumns(md);
  registerSpacer(md);
  registerDivider(md);
  registerSocial(md);
  registerAccordion(md);
  registerChart(md);
  registerProgress(md);
  registerSparkline(md);
}
