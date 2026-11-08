import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getMe().pipe(
    map((user) => {
      if (user && user.role === 'admin') {
        return true;
      }
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url || '/admin' } });
    }),
    catchError(() => {
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url || '/admin' } }));
    })
  );
};
