import { parseHashtags } from './hashtags';

describe('parseHashtags', () => {
  it('extracts unique lowercase hashtags from caption', () => {
    expect(parseHashtags('Hello #world and #NESTJS')).toEqual(['world', 'nestjs']);
  });

  it('deduplicates tags regardless of case', () => {
    expect(parseHashtags('#test #Test #TEST')).toEqual(['test']);
  });

  it('returns empty array when caption has no hashtags', () => {
    expect(parseHashtags('Just a plain caption without tags')).toEqual([]);
  });

  it('handles empty caption safely', () => {
    expect(parseHashtags('')).toEqual([]);
  });
});
