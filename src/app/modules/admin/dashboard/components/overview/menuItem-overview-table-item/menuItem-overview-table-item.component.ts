import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { Router } from '@angular/router';
import { MenuItem } from '../../../../../../core/models';
import { ButtonComponent } from '../../../../../../shared/components/button/button.component';

@Component({
  selector: '[menuItem-overview-table-item]',
  templateUrl: './menuItem-overview-table-item.component.html',
  standalone: true,
  imports: [AngularSvgIconModule, CurrencyPipe, ButtonComponent, CommonModule],
})
export class MenuItemOverviewTableItemComponent implements OnInit {
  @Input() menuItem: MenuItem = <MenuItem>{};
  constructor(private router: Router) {}

  ngOnInit(): void {}

  openUpdateModal() {
    this.router.navigate(['/admin/items'], { queryParams: { edit: this.menuItem.id } });
  }

  openDeleteModal() {
    this.router.navigate(['/admin/items'], { queryParams: { delete: this.menuItem.id } });
  }

  truncateDescription(description: string, maxLength: number = 25): string {
    if (description.length > maxLength) {
      return description.substring(0, maxLength) + '...';
    } else {
      return description;
    }
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/no-image.svg';
  }
}
