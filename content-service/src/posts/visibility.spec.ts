import { buildVisibility } from './visibility';
describe('post visibility', () => {
  it('without follows: public + own only', () => {
    const w: any = buildVisibility('me', []); expect(w.deletedAt).toBeNull();
    expect(w.OR).toEqual([{ visibility: 'public' }, { authorId: 'me' }]);
  });
  it('followers posts only for followed authors', () => {
    const w: any = buildVisibility('me', ['a', 'b']);
    expect(w.OR).toContainEqual({ visibility: 'followers', authorId: { in: ['a', 'b'] } });
    expect(JSON.stringify(w)).not.toContain('"private"');
  });
});
