import { CommonModule, NgClass } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PrimeNGConfig } from 'primeng/api';
import { Observable, filter } from 'rxjs';
import { selectIsLoading } from './core/state/auth/auth.selectors';
import { ThemeService } from './services/theme.service';
import { SharedService } from './services/shared.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [NgClass, RouterOutlet, CommonModule, TranslateModule],
})
export class AppComponent implements OnInit {
  title = 'Orix Bio';
  isLoading$: Observable<boolean>;
  isDisplayingOnlyBarCoes$!: Observable<boolean>;

  constructor(
    public themeService: ThemeService,
    private readonly store: Store,
    private readonly router: Router,
    private readonly translate: TranslateService,
    private readonly primengConfig: PrimeNGConfig,
    private readonly sharedService: SharedService,
  ) {
    this.isLoading$ = this.store.select(selectIsLoading);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      window.scrollTo(0, 0);
    });

    // Load the saved language preference from local storage
    const savedLang = localStorage.getItem('selectedLanguage');
    if (savedLang) {
      this.translate.use(savedLang);
    } else {
      // Default language if no saved preference
      this.translate.setDefaultLang('en');
    }
    this.isDisplayingOnlyBarCoes$ = this.sharedService.getIsBarcodeOnlyMode();
  }
  ngOnInit(): void {
    this.primengConfig.ripple = true;
  }
}
