export const MARKER_HEADER_OPEN = '<!--EMAILMD:HEADER_OPEN-->';
export const MARKER_HEADER_CLOSE = '<!--EMAILMD:HEADER_CLOSE-->';
export const MARKER_CALLOUT_OPEN = '<!--EMAILMD:CALLOUT_OPEN-->';
export const MARKER_CALLOUT_CLOSE = '<!--EMAILMD:CALLOUT_CLOSE-->';
export const MARKER_CENTERED_OPEN = '<!--EMAILMD:CENTERED_OPEN-->';
export const MARKER_CENTERED_CLOSE = '<!--EMAILMD:CENTERED_CLOSE-->';
export const MARKER_HIGHLIGHT_OPEN = '<!--EMAILMD:HIGHLIGHT_OPEN-->';
export const MARKER_HIGHLIGHT_CLOSE = '<!--EMAILMD:HIGHLIGHT_CLOSE-->';
export const MARKER_FOOTER_OPEN = '<!--EMAILMD:FOOTER_OPEN-->';
export const MARKER_FOOTER_CLOSE = '<!--EMAILMD:FOOTER_CLOSE-->';
export const MARKER_BUTTON = '<!--EMAILMD:BUTTON';
export const MARKER_BUTTON_END = '-->';
export const MARKER_HERO_CLOSE = '<!--EMAILMD:HERO_CLOSE-->';
export const MARKER_COLUMNS_CLOSE = '<!--EMAILMD:COLUMNS_CLOSE-->';
export const MARKER_COLUMN_CLOSE = '<!--EMAILMD:COLUMN_CLOSE-->';
export const MARKER_SOCIAL_CLOSE = '<!--EMAILMD:SOCIAL_CLOSE-->';
export const MARKER_ACCORDION_CLOSE = '<!--EMAILMD:ACCORDION_CLOSE-->';
export const MARKER_CHART_CLOSE = '<!--EMAILMD:CHART_CLOSE-->';
export const MARKER_PROGRESS_CLOSE = '<!--EMAILMD:PROGRESS_CLOSE-->';

/**
 * A table header row whose cells are all empty (`| | |`) opts the table out of
 * having a header: the row is dropped from both the HTML and plain-text output.
 */
export const EMPTY_TABLE_HEADER_RE = /<thead>\s*<tr>\s*(?:<th[^>]*>\s*<\/th>\s*)+<\/tr>\s*<\/thead>\s*/;
