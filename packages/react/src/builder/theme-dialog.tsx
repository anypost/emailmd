'use client';

import { Fragment, useState, type KeyboardEvent } from 'react';
import { lightTheme, darkTheme, type Theme } from 'emailmd';
import { HexColorPicker } from 'react-colorful';
import { Button, Input, Label, Menu, MenuItem, Modal, Popover, Tip } from './ui.js';
import { ChevronsUpDownIcon, PaintbrushIcon, PlusIcon, XIcon } from './icons.js';
import {
  parseFrontmatter,
  parseFontsMap,
  setFrontmatterKey,
  setFontsMap,
  removeFrontmatterKey,
  removeAllThemeKeys,
  parseChartColors,
  setChartColors,
} from './frontmatter-utils.js';

interface ThemeDialogProps {
  markdown: string;
  onChange: (markdown: string) => void;
}

/** Theme keys every theme has, as opposed to the optional data color roles. */
type CoreThemeKey = { [K in keyof Theme]-?: undefined extends Theme[K] ? never : K }[keyof Theme];

const COLOR_FIELDS: { key: string; label: string; camelKey: CoreThemeKey }[] = [
  { key: 'brand_color', label: 'Brand', camelKey: 'brandColor' },
  { key: 'heading_color', label: 'Headings', camelKey: 'headingColor' },
  { key: 'body_color', label: 'Body Text', camelKey: 'bodyColor' },
  { key: 'background_color', label: 'Background', camelKey: 'backgroundColor' },
  { key: 'content_color', label: 'Content Area', camelKey: 'contentColor' },
  { key: 'card_color', label: 'Cards', camelKey: 'cardColor' },
  { key: 'button_color', label: 'Buttons', camelKey: 'buttonColor' },
  { key: 'button_text_color', label: 'Button Text', camelKey: 'buttonTextColor' },
  { key: 'divider_color', label: 'Dividers', camelKey: 'dividerColor' },
];

// Paired so bg/text sit side-by-side in a 2-col grid
const VARIANT_COLOR_PAIRS: {
  bg: { key: string; label: string; camelKey: CoreThemeKey };
  text: { key: string; label: string; camelKey: CoreThemeKey };
}[] = [
  {
    bg: { key: 'secondary_color', label: 'Secondary', camelKey: 'secondaryColor' },
    text: { key: 'secondary_text_color', label: 'Secondary Text', camelKey: 'secondaryTextColor' },
  },
  {
    bg: { key: 'success_color', label: 'Success', camelKey: 'successColor' },
    text: { key: 'success_text_color', label: 'Success Text', camelKey: 'successTextColor' },
  },
  {
    bg: { key: 'danger_color', label: 'Danger', camelKey: 'dangerColor' },
    text: { key: 'danger_text_color', label: 'Danger Text', camelKey: 'dangerTextColor' },
  },
  {
    bg: { key: 'warning_color', label: 'Warning', camelKey: 'warningColor' },
    text: { key: 'warning_text_color', label: 'Warning Text', camelKey: 'warningTextColor' },
  },
];

/**
 * The optional data color roles. Each falls back to another key's color when
 * unset, so its field shows that color, overridden or not, as the default.
 */
const DATA_COLOR_FIELDS: { key: string; label: string; fallback: { key: string; camelKey: CoreThemeKey } }[] = [
  { key: 'muted_color', label: 'Muted Text', fallback: { key: 'body_color', camelKey: 'bodyColor' } },
  { key: 'positive_color', label: 'Positive Change', fallback: { key: 'success_color', camelKey: 'successColor' } },
  { key: 'negative_color', label: 'Negative Change', fallback: { key: 'danger_color', camelKey: 'dangerColor' } },
];

/** Colors a new palette entry starts from, in order. */
const PALETTE_PRESET = ['#e76e50', '#2a9d90', '#274754', '#e8c468', '#f4a462'];

const TEXT_FIELDS: { key: string; label: string; camelKey: CoreThemeKey }[] = [
  { key: 'font_size', label: 'Font Size', camelKey: 'fontSize' },
  { key: 'line_height', label: 'Line Height', camelKey: 'lineHeight' },
  { key: 'content_width', label: 'Content Width', camelKey: 'contentWidth' },
  { key: 'border_radius', label: 'Border Radius', camelKey: 'borderRadius' },
];

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: 'Georgia', value: "Georgia, Times, 'Times New Roman', serif" },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Palatino', value: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { label: 'Lucida Sans', value: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif" },
  { label: 'Courier New', value: "'Courier New', Courier, monospace" },
];

export function ThemeDialog({ markdown, onChange }: ThemeDialogProps) {
  const [open, setOpen] = useState(false);
  const fm = parseFrontmatter(markdown);
  const fonts = parseFontsMap(markdown);
  const chartColors = parseChartColors(markdown);
  const baseThemeName = fm.theme || 'light';
  const baseTheme = baseThemeName === 'dark' ? darkTheme : lightTheme;

  function handleSet(key: string, value: string) {
    onChange(setFrontmatterKey(markdown, key, value));
  }

  function handleRemove(key: string) {
    onChange(removeFrontmatterKey(markdown, key));
  }

  function handleBaseTheme(value: string) {
    if (value === 'light') {
      onChange(removeFrontmatterKey(markdown, 'theme'));
    } else {
      onChange(setFrontmatterKey(markdown, 'theme', value));
    }
  }

  return (
    <>
      <Tip label="Theme">
        <Button size="icon-sm" aria-label="Theme" onClick={() => setOpen(true)}>
          <PaintbrushIcon />
        </Button>
      </Tip>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Theme"
        description="Customize colors, fonts, and layout."
        size="lg"
        footer={
          <>
            <Button onClick={() => onChange(removeAllThemeKeys(markdown))}>Reset All</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </>
        }
      >
        <div className="emd-theme">
          <div className="emd-theme-row">
            <Label className="emd-theme-row-label">Base Theme</Label>
            <select
              className="emd-select"
              value={baseThemeName}
              onChange={(e) => handleBaseTheme(e.target.value)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <hr className="emd-separator" />

          <p className="emd-theme-heading">Colors</p>
          <div className="emd-theme-grid2">
            {COLOR_FIELDS.map((field) => (
              <ColorField
                key={field.key}
                label={field.label}
                value={fm[field.key]}
                defaultValue={baseTheme[field.camelKey]}
                onSet={(v) => handleSet(field.key, v)}
                onRemove={() => handleRemove(field.key)}
              />
            ))}
          </div>
          <p className="emd-theme-heading">Button Variants</p>
          <div className="emd-theme-grid2">
            {VARIANT_COLOR_PAIRS.map(({ bg, text }) => (
              <Fragment key={bg.key}>
                <ColorField
                  label={bg.label}
                  value={fm[bg.key]}
                  defaultValue={baseTheme[bg.camelKey]}
                  onSet={(v) => handleSet(bg.key, v)}
                  onRemove={() => handleRemove(bg.key)}
                />
                <ColorField
                  label={text.label}
                  value={fm[text.key]}
                  defaultValue={baseTheme[text.camelKey]}
                  onSet={(v) => handleSet(text.key, v)}
                  onRemove={() => handleRemove(text.key)}
                />
              </Fragment>
            ))}
          </div>

          <hr className="emd-separator" />

          <p className="emd-theme-heading">Data</p>
          <p className="emd-theme-hint">
            Charts, stats and breakdowns. Chart colors are the series palette, named{' '}
            <code>chart-1</code>, <code>chart-2</code>… and taken in order by breakdown swatches.
          </p>
          <PaletteField
            colors={chartColors}
            onChange={(next) => onChange(setChartColors(markdown, next))}
          />
          <div className="emd-theme-grid3">
            {DATA_COLOR_FIELDS.map((field) => (
              <ColorField
                key={field.key}
                label={field.label}
                value={fm[field.key]}
                defaultValue={fm[field.fallback.key] ?? baseTheme[field.fallback.camelKey]}
                onSet={(v) => handleSet(field.key, v)}
                onRemove={() => handleRemove(field.key)}
              />
            ))}
          </div>

          <hr className="emd-separator" />

          <p className="emd-theme-heading">Typography &amp; Layout</p>
          <FontFamilyField
            value={fm.font_family}
            defaultValue={baseTheme.fontFamily}
            onSet={(v) => handleSet('font_family', v)}
            onRemove={() => handleRemove('font_family')}
          />
          <div className="emd-theme-grid3">
            {TEXT_FIELDS.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                value={fm[field.key]}
                defaultValue={baseTheme[field.camelKey]}
                onSet={(v) => handleSet(field.key, v)}
                onRemove={() => handleRemove(field.key)}
              />
            ))}
          </div>

          <hr className="emd-separator" />

          <p className="emd-theme-heading">Custom Fonts</p>
          <p className="emd-theme-hint">
            Embed web fonts (e.g. Google Fonts). Use the family name in{' '}
            <code>Font Family</code> above to apply it.
          </p>
          <CustomFontsField fonts={fonts} onChange={(next) => onChange(setFontsMap(markdown, next))} />
        </div>
      </Modal>
    </>
  );
}

function ColorField({
  label,
  value,
  defaultValue,
  onSet,
  onRemove,
}: {
  label: string;
  value: string | undefined;
  defaultValue: string;
  onSet: (value: string) => void;
  onRemove: () => void;
}) {
  const displayValue = value ?? defaultValue;
  const isOverridden = value !== undefined;

  return (
    <div className="emd-field">
      <Label>{label}</Label>
      <div className="emd-field-controls">
        <Popover
          trigger={({ toggle }) => (
            <button
              type="button"
              className="emd-swatch"
              style={{ backgroundColor: displayValue }}
              aria-label={`Pick ${label} color`}
              onClick={toggle}
            />
          )}
          className="emd-popup-picker"
        >
          <HexColorPicker color={displayValue} onChange={onSet} />
        </Popover>
        <Input
          value={displayValue}
          className="emd-input-mono"
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
              onSet(v);
            }
          }}
          onBlur={(e) => {
            const v = e.target.value;
            if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
              onSet(displayValue);
            }
          }}
        />
        {isOverridden && (
          <Button size="icon-sm" aria-label={`Reset ${label}`} onClick={onRemove}>
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The `chart_colors` palette: one swatch per color, in series order. A swatch
 * opens a picker with the color's hex and a button to drop it.
 */
function PaletteField({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (next: string[]) => void;
}) {
  // Bumped on removal so every picker remounts closed, rather than staying
  // open on whichever color slid into the removed one's place.
  const [generation, setGeneration] = useState(0);
  const setAt = (i: number, color: string) => onChange(colors.map((c, j) => (j === i ? color : c)));
  const removeAt = (i: number) => {
    setGeneration((g) => g + 1);
    onChange(colors.filter((_, j) => j !== i));
  };
  const add = () => onChange([...colors, PALETTE_PRESET[colors.length % PALETTE_PRESET.length]]);

  return (
    <div className="emd-field">
      <Label>Chart Colors</Label>
      <div className="emd-palette">
        {colors.map((color, i) => (
          <Popover
            key={`${generation}-${i}`}
            trigger={({ toggle }) => (
              <button
                type="button"
                className="emd-swatch"
                style={{ backgroundColor: color }}
                aria-label={`Edit chart color ${i + 1}`}
                title={`chart-${i + 1}`}
                onClick={toggle}
              />
            )}
            className="emd-popup-picker"
          >
            <HexColorPicker color={color} onChange={(v) => setAt(i, v)} />
            <div className="emd-palette-edit">
              <Input
                value={color}
                className="emd-input-mono"
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAt(i, e.target.value);
                }}
              />
              <Button size="icon-sm" aria-label={`Remove chart color ${i + 1}`} onClick={() => removeAt(i)}>
                <XIcon />
              </Button>
            </div>
          </Popover>
        ))}
        <Tip label="Add color">
          <Button size="icon-sm" aria-label="Add chart color" onClick={add}>
            <PlusIcon />
          </Button>
        </Tip>
        {colors.length === 0 ? (
          <span className="emd-palette-empty">Unset — bars use the brand color.</span>
        ) : (
          <Button size="icon-sm" aria-label="Reset Chart Colors" onClick={() => onChange([])}>
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

function FontFamilyField({
  value,
  defaultValue,
  onSet,
  onRemove,
}: {
  value: string | undefined;
  defaultValue: string;
  onSet: (value: string) => void;
  onRemove: () => void;
}) {
  const isOverridden = value !== undefined;

  return (
    <div className="emd-field">
      <Label>Font Family</Label>
      <div className="emd-field-controls">
        <Input
          value={value ?? ''}
          placeholder={defaultValue}
          onChange={(e) => onSet(e.target.value)}
        />
        <Menu
          align="end"
          className="emd-menu-scroll"
          trigger={({ toggle }) => (
            <Button size="icon-sm" aria-label="Choose font" onClick={toggle}>
              <ChevronsUpDownIcon />
            </Button>
          )}
        >
          {(close) => (
            <>
              {FONT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} close={close} onSelect={() => onSet(opt.value)}>
                  {opt.label}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
        {isOverridden && (
          <Button size="icon-sm" aria-label="Reset font family" onClick={onRemove}>
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomFontsField({
  fonts,
  onChange,
}: {
  fonts: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const entries = Object.entries(fonts);
  const [draftFamily, setDraftFamily] = useState('');
  const [draftUrl, setDraftUrl] = useState('');

  function updateEntry(oldFamily: string, newFamily: string, newUrl: string) {
    const next: Record<string, string> = {};
    for (const [f, u] of entries) {
      if (f === oldFamily) {
        if (newFamily) next[newFamily] = newUrl;
      } else {
        next[f] = u;
      }
    }
    onChange(next);
  }

  function removeEntry(family: string) {
    const next = { ...fonts };
    delete next[family];
    onChange(next);
  }

  function addEntry() {
    const family = draftFamily.trim();
    const url = draftUrl.trim();
    if (!family || !url) return;
    onChange({ ...fonts, [family]: url });
    setDraftFamily('');
    setDraftUrl('');
  }

  const onDraftKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEntry();
    }
  };

  return (
    <div className="emd-fonts">
      {entries.map(([family, url]) => (
        <div key={family} className="emd-fonts-row">
          <Input
            value={family}
            onChange={(e) => updateEntry(family, e.target.value, url)}
            placeholder="Family"
            className="emd-fonts-family"
          />
          <Input
            value={url}
            onChange={(e) => updateEntry(family, family, e.target.value)}
            placeholder="https://fonts.googleapis.com/..."
            className="emd-input-mono"
          />
          <Button size="icon-sm" aria-label={`Remove ${family}`} onClick={() => removeEntry(family)}>
            <XIcon />
          </Button>
        </div>
      ))}
      <div className="emd-fonts-row">
        <Input
          value={draftFamily}
          onChange={(e) => setDraftFamily(e.target.value)}
          placeholder="Family (e.g. Inter)"
          className="emd-fonts-family"
          onKeyDown={onDraftKeyDown}
        />
        <Input
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://fonts.googleapis.com/css2?family=Inter"
          className="emd-input-mono"
          onKeyDown={onDraftKeyDown}
        />
        <Button
          size="icon-sm"
          aria-label="Add font"
          onClick={addEntry}
          disabled={!draftFamily.trim() || !draftUrl.trim()}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  defaultValue,
  onSet,
  onRemove,
}: {
  label: string;
  value: string | undefined;
  defaultValue: string;
  onSet: (value: string) => void;
  onRemove: () => void;
}) {
  const isOverridden = value !== undefined;

  return (
    <div className="emd-field">
      <Label>{label}</Label>
      <div className="emd-field-controls">
        <Input
          value={value ?? ''}
          placeholder={defaultValue}
          onChange={(e) => onSet(e.target.value)}
        />
        {isOverridden && (
          <Button size="icon-sm" aria-label={`Reset ${label}`} onClick={onRemove}>
            <XIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
