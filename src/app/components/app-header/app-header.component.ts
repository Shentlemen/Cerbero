import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/auth.interface';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.css']
})
export class AppHeaderComponent implements OnInit {
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'GM': return 'Game Master';
      case 'ADMIN': return 'Administrador';
      case 'USER': return 'Usuario';
      default: return role;
    }
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'GM': return 'bg-danger';
      case 'ADMIN': return 'bg-warning';
      case 'USER': return 'bg-secondary';
      default: return 'bg-secondary';
    }
  }

  logout(): void {
    this.authService.logout();
    window.location.href = '/#/login';
  }

  goToProfile(): void {
    this.router.navigate(['/user-profile']);
  }
} 