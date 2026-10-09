import { blockKey, isBlockedEitherWay } from './blocks';
describe('blocks', () => {
  it('detects blocks in either direction only for the pair', () => {
    const s = new Set([blockKey('a', 'b')]);
    expect(isBlockedEitherWay(s, 'a', 'b')).toBe(true); expect(isBlockedEitherWay(s, 'b', 'a')).toBe(true); expect(isBlockedEitherWay(s, 'a', 'c')).toBe(false);
  });
});
