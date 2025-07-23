import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/auth.interface';

@Component({
  selector: 'app-user-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-header.component.html',
  styleUrls: ['./user-header.component.css']
})
export class UserHeaderComponent implements OnInit {
  @Input() inMenu: boolean = false;
  currentUser: User | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  logout(): void {
    this.authService.logout();
    // Redirigir al login
    window.location.href = '/#/login';
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'GM': return 'Game Master';
      case 'ADMIN': return 'Administrador';
      case 'USER': return 'Usuario';
      default: return role;
    }
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'GM': return 'fas fa-crown'; // Corona para Game Master
      case 'ADMIN': return 'fas fa-shield-alt'; // Escudo para Administrador
      case 'USER': return 'fas fa-user'; // Usuario normal
      default: return 'fas fa-user-circle';
    }
  }
} 