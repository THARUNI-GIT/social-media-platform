import { ArgumentsHost, CallHandler, Catch, ExceptionFilter, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_c: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}

@Catch()
export class EnvelopeFilter implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = e instanceof HttpException ? e.getStatus() : 500;
    const r: any = e instanceof HttpException ? e.getResponse() : {};
    const msg = Array.isArray(r?.message) ? r.message.join('; ') : r?.message ?? e?.message ?? 'Internal error';
    res.status(status).json({
      success: false,
      error: {
        code: r?.code ?? (status === 400 ? 'VALIDATION_ERROR' : status === 500 ? 'INTERNAL' : String(r?.error ?? 'ERROR').toUpperCase().replace(/\s+/g, '_')),
        message: status === 500 ? 'Internal error' : msg,
      },
    });
  }
}
