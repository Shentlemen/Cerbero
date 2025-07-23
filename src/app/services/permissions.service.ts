import { Injectable } from '@angular/core';

export interface User {
  id?: number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  enabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private currentUser: User | null = null;

  constructor() {
    // Get user from localStorage
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
  }

  setCurrentUser(user: User): void {
    this.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  clearCurrentUser(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }

  // Role checks
  isGM(): boolean {
    return this.currentUser?.role === 'GM';
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  isUser(): boolean {
    return this.currentUser?.role === 'USER';
  }

  isGMOrAdmin(): boolean {
    return this.isGM() || this.isAdmin();
  }

  // Specific permissions
  canManageUsers(): boolean {
    return this.isGM(); // Only GM can manage users
  }

  canConfirmAlerts(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can confirm alerts
  }

  canManageSoftware(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can hide/forbid software
  }

  canManageAssets(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can create/edit/delete assets
  }

  canEditAssets(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can create/edit/delete assets
  }

  canManagePurchases(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can manage purchases
  }

  canManageProviders(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can manage providers
  }

  canManageSubnets(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can edit subnets
  }

  canAccessConfiguration(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can access configuration menu
  }

  // Helper method to check if user is logged in
  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
} 