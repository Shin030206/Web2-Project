import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Attach withCredentials: true to all /api/ requests so httpOnly cookies are sent
  if (req.url.startsWith('/api') || req.url.includes('/api/')) {
    return next(req.clone({ withCredentials: true }));
  }
  return next(req);
};
