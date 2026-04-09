import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
  private static readonly VIEW_AS_KEY = 'cerberoGmViewAsRole';

  private currentUser: User | null = null;
  /** Solo para GM: simular otro rol en la UI (JWT y rol real no cambian). */
  private viewAsRole: string | null = null;
  private readonly viewAsSubject = new BehaviorSubject<string | null>(null);
  /** Emite cuando cambia la simulación (para layout / header). */
  readonly viewAs$ = this.viewAsSubject.asObservable();

  constructor() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
        if (this.currentUser?.role === 'GM') {
          this.loadViewAsFromStorage();
        }
      } catch {
        this.currentUser = null;
      }
    }
  }

  private loadViewAsFromStorage(): void {
    const raw = localStorage.getItem(PermissionsService.VIEW_AS_KEY);
    this.viewAsRole = raw && raw.length > 0 ? raw : null;
    this.viewAsSubject.next(this.viewAsRole);
  }

  private clearViewAsInternal(): void {
    this.viewAsRole = null;
    localStorage.removeItem(PermissionsService.VIEW_AS_KEY);
    this.viewAsSubject.next(null);
  }

  /** Rol usado en menú y permisos de pantalla. */
  getEffectiveRole(): string | null {
    if (!this.currentUser) return null;
    if (this.currentUser.role === 'GM' && this.viewAsRole) {
      return this.viewAsRole;
    }
    return this.currentUser.role;
  }

  /** Rol real de la sesión (JWT / usuario guardado). */
  getRealRole(): string | null {
    return this.currentUser?.role ?? null;
  }

  /** Sesión es GM (sin importar simulación). */
  isRealGM(): boolean {
    return this.currentUser?.role === 'GM';
  }

  getViewAsRole(): string | null {
    return this.viewAsRole;
  }

  /** GM está simulando otro rol (para barra de aviso y offset del layout). */
  isGmPreviewActive(): boolean {
    return this.isRealGM() && !!this.viewAsRole;
  }

  /**
   * Solo GM. Pasar null o '' para volver a vista normal.
   * No altera el token ni el objeto user en localStorage.
   */
  setViewAsRole(role: string | null | undefined): void {
    if (!this.isRealGM()) return;
    const next = role && role.trim().length > 0 ? role.trim().toUpperCase() : null;
    if (!next) {
      this.clearViewAsInternal();
      return;
    }
    this.viewAsRole = next;
    localStorage.setItem(PermissionsService.VIEW_AS_KEY, next);
    this.viewAsSubject.next(next);
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      if (user.role !== 'GM') {
        this.clearViewAsInternal();
      } else {
        this.loadViewAsFromStorage();
      }
    } else {
      localStorage.removeItem('currentUser');
      this.clearViewAsInternal();
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  clearCurrentUser(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    this.clearViewAsInternal();
  }

  // Role checks (rol efectivo para la UI)
  isGM(): boolean {
    return this.getEffectiveRole() === 'GM';
  }

  isAdmin(): boolean {
    return this.getEffectiveRole() === 'ADMIN';
  }

  isUser(): boolean {
    return this.getEffectiveRole() === 'USER';
  }

  isAlmacen(): boolean {
    return this.getEffectiveRole() === 'ALMACEN';
  }

  isInventario(): boolean {
    return this.getEffectiveRole() === 'INVENTARIO';
  }

  isCompras(): boolean {
    return this.getEffectiveRole() === 'COMPRAS';
  }

  isGestionEquip(): boolean {
    return this.getEffectiveRole() === 'GESTION_EQUIP';
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

  /** Cementerio y almacén laboratorio: transferir y reactivar excluyen rol ALMACEN. */
  canTransferOrReactivateInCemeteryOrLabWarehouse(): boolean {
    return this.canManageEquipmentStates() && !this.isAlmacen();
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

  /**
   * Bloque «Administración» (sidebar): exclusivo de GM y Admin, no el rol USER ni personal de área.
   */
  canAccessAdministrationMenu(): boolean {
    if (this.isUser()) return false;
    return this.isGMOrAdmin();
  }

  canUpdateNetworkDevices(): boolean {
    return this.isGMOrAdmin(); // GM and Admin can update network devices
  }

  // Tickets / Reclamos
  canAccessTickets(): boolean {
    return this.isLoggedIn();
  }

  canCreateTickets(): boolean {
    return this.isLoggedIn();
  }

  canProcessTicketsForArea(areaCodigo: string): boolean {
    if (!this.currentUser || !areaCodigo) return false;
    if (this.isGMOrAdmin()) return true;
    if (this.isUser()) return false;
    return this.getEffectiveRole() === areaCodigo;
  }

  // Helper method to check if user is logged in
  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
} 