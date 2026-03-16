import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('returns user when authenticated', () => {
    const user = { userId: '123' };
    expect(guard.handleRequest(null, user, null)).toEqual(user);
  });

  it('throws UnauthorizedException when user is missing', () => {
    expect(() => guard.handleRequest(null, null, { message: 'No auth token' })).toThrow(UnauthorizedException);
  });

  it('rethrows passport error as is', () => {
    const err = new Error('passport error');
    expect(() => guard.handleRequest(err, null, null)).toThrow('passport error');
  });
});
