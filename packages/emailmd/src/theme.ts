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
