import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
export interface Ctx { userId: string; roles: string[] }
const read = (req: any): Ctx | null => { const id = req.headers['x-user-id']; if (!id) return null;
  return { userId: String(id), roles: String(req.headers['x-user-roles'] ?? '').split(',').map((s) => s.trim()).filter(Boolean) }; };
/** Trusts gateway headers. */
@Injectable() export class HeaderAuthGuard implements CanActivate {
  canActivate(c: ExecutionContext) { const req = c.switchToHttp().getRequest(); const x = read(req);
    if (!x) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing x-user-id' }); req.ctx = x; return true; }
}
@Injectable() export class AdminGuard implements CanActivate {
  canActivate(c: ExecutionContext) { const req = c.switchToHttp().getRequest(); const x = read(req);
    if (!x) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing x-user-id' });
    if (!x.roles.includes('admin')) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Admin only' }); req.ctx = x; return true; }
}
export const Me = createParamDecorator((_d, c: ExecutionContext): Ctx => c.switchToHttp().getRequest().ctx);
/** Optional viewer (public routes like GET /posts). */
export const Viewer = createParamDecorator((_d, c: ExecutionContext): string | null => read(c.switchToHttp().getRequest())?.userId ?? null);
