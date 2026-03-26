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

  isAlmacen(): boolean {
    return this.currentUser?.role === 'ALMACEN';
  }

  isInventario(): boolean {
    return this.currentUser?.role === 'INVENTARIO';
  }

  isCompras(): boolean {
    return this.currentUser?.role === 'COMPRAS';
  }

  isGestionEquip(): boolean {
    return this.currentUser?.role === 'GESTION_EQUIP';
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

  // Gestión completa de assets en módulos de almacén (stock, 3D, cementerio, lab)
  canManageWarehouseAssets(): boolean {
    return this.isGMOrAdmin() || this.isAlmacen();
  }

  // Gestión de movimientos/estado de equipos (baja, almacén, transferir, reactivar)
  canManageEquipmentStates(): boolean {
    return this.isGMOrAdmin() || this.isAlmacen() || this.isGestionEquip();
  }

  // Eliminación de assets solo para GM/Admin
  canDeleteAssets(): boolean {
    return this.isGMOrAdmin();
  }

  canEditAssets(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can create/edit/delete assets
  }

  canManagePurchases(): boolean {
    return this.isGMOrAdmin() || this.isCompras(); // GM, Admin y Compras pueden gestionar compras
  }

  canManageProviders(): boolean {
    return this.isGMOrAdmin() || this.isCompras(); // GM, Admin y Compras pueden gestionar proveedores
  }

  canManageSubnets(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can edit subnets
  }

  canAccessConfiguration(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can access configuration menu
  }

  canUpdateNetworkDevices(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can update network devices
  }

  // Helper method to check if user is logged in
  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
} 