import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
/** Trusts gateway headers (same convention as the rest of the platform). */
const read = (req: any) => { const id = req.headers['x-user-id']; return id ? { userId: String(id), roles: String(req.headers['x-user-roles'] ?? '').split(',').map((s) => s.trim()).filter(Boolean) } : null; };
@Injectable() export class UserGuard implements CanActivate { canActivate(c: ExecutionContext) { const r = c.switchToHttp().getRequest(); const x = read(r); if (!x) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing x-user-id' }); r.ctx = x; return true; } }
@Injectable() export class AdminOnly implements CanActivate { canActivate(c: ExecutionContext) { const r = c.switchToHttp().getRequest(); const x = read(r); if (!x) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing x-user-id' });
  if (!x.roles.includes('admin')) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Admin only' }); r.ctx = x; return true; } }
export const Actor = createParamDecorator((_d, c: ExecutionContext): { userId: string; roles: string[] } => c.switchToHttp().getRequest().ctx);
