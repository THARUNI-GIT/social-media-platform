import { canTransition, nextStatus, recipientsOf, statusAfterRead } from './message-status';
describe('message status transitions', () => {
  it('moves forward only', () => {
    expect(canTransition('sent', 'delivered')).toBe(true);
    expect(canTransition('delivered', 'read')).toBe(true);
    expect(canTransition('sent', 'read')).toBe(true);
    expect(canTransition('read', 'delivered')).toBe(false);
    expect(canTransition('delivered', 'delivered')).toBe(false);
  });
  it('nextStatus never downgrades', () => { expect(nextStatus('read', 'delivered')).toBe('read'); expect(nextStatus('sent', 'delivered')).toBe('delivered'); });
  it('recipients exclude sender', () => expect(recipientsOf(['a', 'b', 'c'], 'a')).toEqual(['b', 'c']));
  it('read adds reader once and sets read', () => {
    const r = statusAfterRead([{ userId: 'b' }], 'b', 'delivered');
    expect(r).toEqual({ status: 'read', readBy: ['b'] });
    expect(statusAfterRead([], 'c', 'sent').readBy).toEqual(['c']);
  });
});
