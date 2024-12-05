import { Component } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterModule, RouterOutlet],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent {
  isAssetsExpanded: boolean = false;

  toggleAssetsMenu(): void {
    this.isAssetsExpanded = !this.isAssetsExpanded;
  }
}
