import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { isAuthenticatedGuard, isUnauthenticatedGuard } from './core/guards/role.guard';

const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule),
    canActivate: [isUnauthenticatedGuard],
  },
  {
    path: 'pos',
    loadComponent: () => import('./modules/pos/pos.component').then(m => m.PosComponent),
    canActivate: [isAuthenticatedGuard],
  },
  {
    path: 'admin',
    loadChildren: () => import('./modules/admin/admin.module').then(m => m.AdminModule),
    canActivate: [isAuthenticatedGuard],
  },
  {
    path: '',
    loadChildren: () => import('./modules/user/user.module').then(m => m.UserModule),
    canActivate: [isAuthenticatedGuard],
  },
  {
    path: '**',
    redirectTo: 'error/404'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
