import { decide } from './rules';
describe('moderation decisions', () => {
  it('remove resolves and deletes content; dismiss keeps it', () => {
    expect(decide('remove')).toEqual({ status: 'resolved', removeContent: true });
    expect(decide('dismiss')).toEqual({ status: 'dismissed', removeContent: false });
  });
});
