import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;

  constructor(private authService: AuthService, private router: Router, private toastr: ToastrService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      request = request.clone({
        setHeaders: { Authorization: `Bearer ${accessToken}` },
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Don't try to refresh on the auth endpoints themselves to avoid loops
        const isAuthCall = request.url.includes('/api/auth/');

        if (error.status === 401 && !this.isRefreshing && !isAuthCall) {
          this.isRefreshing = true;
          return this.authService.refreshToken().pipe(
            switchMap((newAccessToken: string) => {
              localStorage.setItem('accessToken', newAccessToken);
              this.isRefreshing = false;
              const retried = request.clone({
                setHeaders: { Authorization: `Bearer ${newAccessToken}` },
              });
              // Retry once. If it fails AGAIN with 401 → force logout (no infinite loop).
              return next.handle(retried).pipe(
                catchError((retryErr: HttpErrorResponse) => {
                  if (retryErr.status === 401) {
                    this.forceLogout('Session invalide — veuillez vous reconnecter');
                  }
                  return throwError(() => retryErr);
                }),
              );
            }),
            catchError(() => {
              this.isRefreshing = false;
              this.forceLogout('Session expirée — veuillez vous reconnecter');
              return throwError(() => new Error('Session expired'));
            }),
            finalize(() => {
              this.isRefreshing = false;
            }),
          );
        }

        // 401 on auth endpoints OR while already refreshing → fail directly + logout
        if (error.status === 401) {
          this.forceLogout('Session expirée');
        }
        return throwError(() => error);
      }),
    );
  }

  private forceLogout(message: string): void {
    this.toastr.info(message);
    localStorage.removeItem('accessToken');
    sessionStorage.clear();
    this.router.navigate(['/auth/sign-in']);
  }
}
