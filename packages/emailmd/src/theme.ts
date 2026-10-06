export interface Theme {
  brandColor: string;
  headingColor: string;
  bodyColor: string;
  backgroundColor: string;
  contentColor: string;
  cardColor: string;
  buttonColor: string;
  buttonTextColor: string;
  secondaryColor: string;
  secondaryTextColor: string;
  successColor: string;
  successTextColor: string;
  dangerColor: string;
  dangerTextColor: string;
  warningColor: string;
  warningTextColor: string;
  dividerColor: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  contentWidth: string;
  borderRadius: string;
  /**
   * Secondary text: data labels, captions, the header and footer, and a
   * change with no good or bad reading. Falls back to `bodyColor`.
   */
  mutedColor?: string;
  /**
   * Data colors, in series order. Chart, progress and sparkline bars default
   * to the first, and `color=chart-2` names the second. Falls back to
   * `brandColor` for the default bar.
   */
  chartColors?: string[];
  /** Text color of a change that is good news (▲ +12%). Falls back to `successColor`. */
  positiveColor?: string;
  /** Text color of a change that is bad news (▼ −3%). Falls back to `dangerColor`. */
  negativeColor?: string;
}

/** The color for secondary text: `mutedColor`, else `bodyColor`. */
export function mutedColorOf(theme: Theme): string {
  return theme.mutedColor ?? theme.bodyColor;
}

/** The default data color: the first of `chartColors`, else `brandColor`. */
export function dataColorOf(theme: Theme): string {
  return theme.chartColors?.[0] ?? theme.brandColor;
}

/** The text color of a good change: `positiveColor`, else `successColor`. */
export function positiveColorOf(theme: Theme): string {
  return theme.positiveColor ?? theme.successColor;
}

/** The text color of a bad change: `negativeColor`, else `dangerColor`. */
export function negativeColorOf(theme: Theme): string {
  return theme.negativeColor ?? theme.dangerColor;
}

const sharedTypography = {
  fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: '16px',
  lineHeight: '1.6',
  contentWidth: '600px',
  borderRadius: '8px',
};

export const lightTheme: Theme = {
  brandColor: '#18181b',
  headingColor: '#09090b',
  bodyColor: '#71717a',
  backgroundColor: '#fafafa',
  contentColor: '#ffffff',
  cardColor: '#f4f4f5',
  buttonColor: '#18181b',
  buttonTextColor: '#fafafa',
  secondaryColor: '#18181b',
  secondaryTextColor: '#18181b',
  successColor: '#16a34a',
  successTextColor: '#ffffff',
  dangerColor: '#dc2626',
  dangerTextColor: '#ffffff',
  warningColor: '#d97706',
  warningTextColor: '#ffffff',
  dividerColor: '#f4f4f5',
  ...sharedTypography,
};

export const darkTheme: Theme = {
  brandColor: '#fafafa',
  headingColor: '#fafafa',
  bodyColor: '#a1a1aa',
  backgroundColor: '#09090b',
  contentColor: '#18181b',
  cardColor: '#27272a',
  buttonColor: '#fafafa',
  buttonTextColor: '#18181b',
  secondaryColor: '#fafafa',
  secondaryTextColor: '#fafafa',
  successColor: '#16a34a',
  successTextColor: '#ffffff',
  dangerColor: '#dc2626',
  dangerTextColor: '#ffffff',
  warningColor: '#d97706',
  warningTextColor: '#ffffff',
  dividerColor: '#27272a',
  ...sharedTypography,
};

export const defaultTheme: Theme = { ...lightTheme };

export function resolveBaseTheme(name?: string): Theme {
  if (name === 'dark') return darkTheme;
  // `auto` renders light by default and adapts via prefers-color-scheme.
  if (name === 'light' || name === 'auto') return lightTheme;
  return defaultTheme;
}

export function mergeTheme(overrides?: Partial<Theme>, base?: Theme): Theme {
  const b = base ?? defaultTheme;
  if (!overrides) return { ...b };
  return { ...b, ...overrides };
}
