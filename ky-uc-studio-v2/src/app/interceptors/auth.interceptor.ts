import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Attach withCredentials: true and Bearer token to all /api/ requests
  if (req.url.startsWith('/api') || req.url.includes('/api/')) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('kyuc_token') : null;
    let headers = req.headers;
    if (token && !headers.has('Authorization')) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    const cloned = req.clone({
      headers,
      withCredentials: true
    });
    return next(cloned);
  }
  return next(req);
};
