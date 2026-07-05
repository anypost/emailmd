import { describe, it, expect } from 'vitest';
import { parseDirectiveParams, serializeMarkerAttrs } from '../src/params.js';

describe('parseDirectiveParams', () => {
  it('returns empty object for no params', () => {
    expect(parseDirectiveParams('callout', 'callout')).toEqual({});
  });

  it('returns empty object for directive name with whitespace only', () => {
    expect(parseDirectiveParams('  callout  ', 'callout')).toEqual({});
  });

  it('parses center alignment keyword', () => {
    expect(parseDirectiveParams('callout center', 'callout')).toEqual({ align: 'center' });
  });

  it('parses left alignment keyword', () => {
    expect(parseDirectiveParams('callout left', 'callout')).toEqual({ align: 'left' });
  });

  it('parses right alignment keyword', () => {
    expect(parseDirectiveParams('callout right', 'callout')).toEqual({ align: 'right' });
  });

  it('parses compact padding keyword', () => {
    expect(parseDirectiveParams('callout compact', 'callout')).toEqual({ padding: 'compact' });
  });

  it('parses spacious padding keyword', () => {
    expect(parseDirectiveParams('callout spacious', 'callout')).toEqual({ padding: 'spacious' });
  });

  it('parses key=value color', () => {
    expect(parseDirectiveParams('callout color=#1e40af', 'callout')).toEqual({ color: '#1e40af' });
  });

  it('parses key=value bg', () => {
    expect(parseDirectiveParams('callout bg=#eff6ff', 'callout')).toEqual({ bg: '#eff6ff' });
  });

  it('parses mixed keywords and key=value pairs', () => {
    expect(parseDirectiveParams('callout center compact color=#1e40af bg=#eff6ff', 'callout')).toEqual({
      align: 'center',
      padding: 'compact',
      color: '#1e40af',
      bg: '#eff6ff',
    });
  });

  it('handles extra whitespace', () => {
    expect(parseDirectiveParams('  callout   center  ', 'callout')).toEqual({ align: 'center' });
  });

  it('works for different directive names', () => {
    expect(parseDirectiveParams('highlight center', 'highlight')).toEqual({ align: 'center' });
    expect(parseDirectiveParams('header left', 'header')).toEqual({ align: 'left' });
    expect(parseDirectiveParams('footer right', 'footer')).toEqual({ align: 'right' });
  });

  it('ignores unknown bare keywords', () => {
    expect(parseDirectiveParams('callout unknown', 'callout')).toEqual({});
  });

  it('strips double quotes around a value', () => {
    expect(parseDirectiveParams('callout bg="#eff6ff"', 'callout')).toEqual({ bg: '#eff6ff' });
  });

  it('strips single quotes around a value', () => {
    expect(parseDirectiveParams("callout color='#1e40af'", 'callout')).toEqual({ color: '#1e40af' });
  });

  it('keeps an unmatched quote in the value', () => {
    expect(parseDirectiveParams('callout bg="#eff6ff', 'callout')).toEqual({ bg: '"#eff6ff' });
  });
});

describe('serializeMarkerAttrs', () => {
  it('returns empty string for empty params', () => {
    expect(serializeMarkerAttrs({})).toBe('');
  });

  it('returns empty string when all values are undefined', () => {
    expect(serializeMarkerAttrs({ align: undefined })).toBe('');
  });

  it('serializes single param', () => {
    expect(serializeMarkerAttrs({ align: 'center' })).toBe(' align="center"');
  });

  it('serializes multiple params', () => {
    const result = serializeMarkerAttrs({ align: 'center', bg: '#eff6ff' });
    expect(result).toBe(' align="center" bg="#eff6ff"');
  });

  it('filters out undefined values', () => {
    expect(serializeMarkerAttrs({ align: 'center', padding: undefined })).toBe(' align="center"');
  });

  it('strips double quotes from values so markers stay parseable', () => {
    expect(serializeMarkerAttrs({ bg: '"#eff6ff' })).toBe(' bg="#eff6ff"');
  });
});
