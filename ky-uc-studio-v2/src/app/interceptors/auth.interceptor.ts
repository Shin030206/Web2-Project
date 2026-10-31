import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Attach withCredentials: true to all /api/ requests so browser sends auth and draft cookies
  if (req.url.startsWith('/api') || req.url.includes('/api/')) {
    const cloned = req.clone({
      withCredentials: true
    });
    return next(cloned);
  }
  return next(req);
};
