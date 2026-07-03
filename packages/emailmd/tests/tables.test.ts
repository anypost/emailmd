import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const SIMPLE_TABLE = `| Name | Age |
| ---- | --- |
| Alice | 30 |
| Bob | 25 |`;

const ALIGNED_TABLE = `| Left | Center | Right |
| :--- | :----: | ----: |
| a | b | c |`;

const HEADERLESS_TABLE = `|       |    |
| ----- | -- |
| Alice | 30 |
| Bob   | 25 |`;

describe('table support', async () => {
  describe('basic rendering', async () => {
    it('renders a simple table with all data visible', async () => {
      const { html } = await render(SIMPLE_TABLE);
      expect(html).toContain('Name');
      expect(html).toContain('Age');
      expect(html).toContain('Alice');
      expect(html).toContain('30');
      expect(html).toContain('Bob');
      expect(html).toContain('25');
    });

    it('contains no MJML tags in output', async () => {
      const { html } = await render(SIMPLE_TABLE);
      expect(html).not.toMatch(/<mj-/);
    });

    it('contains no EMAILMD markers in output', async () => {
      const { html } = await render(SIMPLE_TABLE);
      expect(html).not.toContain('EMAILMD:');
    });
  });

  describe('column alignment', async () => {
    it('preserves left alignment', async () => {
      const md = '| Name |\n| :--- |\n| Alice |';
      const { html } = await render(md);
      expect(html).toContain('text-align:left');
    });

    it('preserves center alignment', async () => {
      const md = '| Name |\n| :---: |\n| Alice |';
      const { html } = await render(md);
      expect(html).toContain('text-align:center');
    });

    it('preserves right alignment', async () => {
      const md = '| Name |\n| ---: |\n| Alice |';
      const { html } = await render(md);
      expect(html).toContain('text-align:right');
    });

    it('handles mixed alignments', async () => {
      const { html } = await render(ALIGNED_TABLE);
      expect(html).toContain('text-align:left');
      expect(html).toContain('text-align:center');
      expect(html).toContain('text-align:right');
    });
  });

  describe('styling', async () => {
    it('applies header border styling', async () => {
      const { html } = await render(SIMPLE_TABLE);
      expect(html).toContain('border-bottom');
    });

    it('uses theme colors', async () => {
      const { html } = await render(SIMPLE_TABLE);
      expect(html).toContain('#71717a'); // default bodyColor
    });
  });

  describe('headerless tables', async () => {
    it('drops an all-empty header row', async () => {
      const { html } = await render(HEADERLESS_TABLE);
      expect(html).toContain('Alice');
      expect(html).toContain('30');
      expect(html).not.toContain('<th');
    });

    it('keeps column alignment from the delimiter row', async () => {
      const md = '|   |   |\n| :--- | ---: |\n| a | b |';
      const { html } = await render(md);
      expect(html).toContain('text-align:left');
      expect(html).toContain('text-align:right');
    });

    it('keeps the header row when any header cell has content', async () => {
      const md = '| Name |   |\n| ---- | --- |\n| Alice | 30 |';
      const { html } = await render(md);
      expect(html).toContain('<th');
      expect(html).toContain('Name');
    });

    it('only affects the table with the empty header when mixed', async () => {
      const md = `${SIMPLE_TABLE}\n\n${HEADERLESS_TABLE}`;
      const { html } = await render(md);
      expect(html).toContain('<th');
      expect(html).toContain('Name');
      expect(html).toContain('Alice');
    });
  });

  describe('with surrounding content', async () => {
    it('renders text before and after a table', async () => {
      const md = `# Welcome

${SIMPLE_TABLE}

More content below.`;
      const { html } = await render(md);
      expect(html).toContain('Welcome');
      expect(html).toContain('Alice');
      expect(html).toContain('More content below.');
    });

    it('handles multiple tables', async () => {
      const md = `| A |\n| - |\n| 1 |\n\n| B |\n| - |\n| 2 |`;
      const { html } = await render(md);
      expect(html).toContain('A');
      expect(html).toContain('1');
      expect(html).toContain('B');
      expect(html).toContain('2');
    });
  });
});

describe('table plain text output', async () => {
  it('converts a table to aligned text', async () => {
    const { text } = await render(SIMPLE_TABLE);
    expect(text).toContain('Name');
    expect(text).toContain('Alice');
    expect(text).toContain('30');
    expect(text).toContain('Bob');
    expect(text).toContain('25');
  });

  it('includes a separator after the header', async () => {
    const { text } = await render(SIMPLE_TABLE);
    expect(text).toContain('---');
  });

  it('contains no HTML tags', async () => {
    const { text } = await render(SIMPLE_TABLE);
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it('drops the empty header row and separator for headerless tables', async () => {
    const { text } = await render(HEADERLESS_TABLE);
    expect(text).toContain('Alice');
    expect(text).toContain('30');
    expect(text).not.toContain('---');
    // The empty header row itself is gone — the first table line is data.
    const lines = text.split('\n').filter((l) => l.trim());
    expect(lines[0]).toContain('Alice');
  });

  it('aligns columns with padding', async () => {
    const { text } = await render(SIMPLE_TABLE);
    const lines = text.split('\n').filter((l) => l.trim());
    const aliceLine = lines.find((l) => l.includes('Alice'));
    const bobLine = lines.find((l) => l.includes('Bob'));
    expect(aliceLine).toBeDefined();
    expect(bobLine).toBeDefined();
    // Both data rows should have the same column offset for the second column
    const aliceAgeIndex = aliceLine!.indexOf('30');
    const bobAgeIndex = bobLine!.indexOf('25');
    expect(aliceAgeIndex).toBe(bobAgeIndex);
  });
});
