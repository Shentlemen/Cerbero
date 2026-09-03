import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';

export interface User {
  id?: number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  enabled: boolean;
  ticketAreaCodigo?: string | null;
  areaId?: number | null;
  areaCodigo?: string | null;
  areaNombre?: string | null;
  permisos?: Array<{
    componente: string;
    puedeVer: boolean;
    puedeEditar: boolean;
    puedeEliminar: boolean;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private static readonly VIEW_AS_KEY = 'cerberoGmViewAsRole';

  private currentUser: User | null = null;
  /** Solo para GM: simular otro rol/área en la UI (JWT y rol real no cambian). */
  private viewAsRole: string | null = null;
  private viewAsAreaId: number | null = null;
  private viewAsPermisos: User['permisos'] | undefined = undefined;
  private readonly viewAsSubject = new BehaviorSubject<string | null>(null);
  /** Emite cuando cambia la simulación (para layout / header). */
  readonly viewAs$ = this.viewAsSubject.asObservable();

  constructor(private notificationService: NotificationService) {
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
    if (!raw) {
      this.viewAsRole = null;
      this.viewAsAreaId = null;
      this.viewAsPermisos = undefined;
      this.viewAsSubject.next(null);
      return;
    }
    try {
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw) as {
          codigo?: string;
          areaId?: number | null;
          permisos?: User['permisos'];
        };
        const codigo = (parsed.codigo || '').trim().toUpperCase();
        this.viewAsRole = codigo || null;
        this.viewAsAreaId = parsed.areaId ?? null;
        this.viewAsPermisos = parsed.permisos;
      } else {
        this.viewAsRole = raw.trim().toUpperCase();
        this.viewAsAreaId = null;
        this.viewAsPermisos = undefined;
      }
    } catch {
      this.viewAsRole = raw.trim().toUpperCase();
      this.viewAsAreaId = null;
      this.viewAsPermisos = undefined;
    }
    this.viewAsSubject.next(this.viewAsRole);
  }

  private persistViewAs(): void {
    if (!this.viewAsRole) {
      localStorage.removeItem(PermissionsService.VIEW_AS_KEY);
      return;
    }
    localStorage.setItem(
      PermissionsService.VIEW_AS_KEY,
      JSON.stringify({
        codigo: this.viewAsRole,
        areaId: this.viewAsAreaId,
        permisos: this.viewAsPermisos
      })
    );
  }

  private clearViewAsInternal(): void {
    this.viewAsRole = null;
    this.viewAsAreaId = null;
    this.viewAsPermisos = undefined;
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

  /** Sesión es ADMIN real (sin importar simulación). */
  isRealAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  /** Sesión real es GM o ADMIN (sin importar simulación). */
  isRealGmOrAdmin(): boolean {
    return this.isRealGM() || this.isRealAdmin();
  }

  getViewAsRole(): string | null {
    return this.viewAsRole;
  }

  getViewAsAreaId(): number | null {
    return this.viewAsAreaId;
  }

  hasViewAsPermisos(): boolean {
    return !!this.viewAsPermisos?.length;
  }

  /** GM está simulando otro rol (para barra de aviso y offset del layout). */
  isGmPreviewActive(): boolean {
    return this.isRealGM() && !!this.viewAsRole;
  }

  /**
   * Solo GM. Pasar null o '' para volver a vista normal.
   * No altera el token ni el objeto user en localStorage.
   */
  setViewAsRole(
    role: string | null | undefined,
    permisos?: User['permisos'],
    areaId?: number | null
  ): void {
    if (!this.isRealGM()) return;
    const next = role && role.trim().length > 0 ? role.trim().toUpperCase() : null;
    if (!next) {
      this.clearViewAsInternal();
      return;
    }
    this.viewAsRole = next;
    this.viewAsAreaId = areaId ?? this.viewAsAreaId;
    this.viewAsPermisos = permisos;
    this.persistViewAs();
    this.viewAsSubject.next(this.viewAsRole);
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
  can(componente: string, accion: 'ver' | 'editar' | 'eliminar' = 'ver'): boolean {
    if (!this.currentUser) return false;
    if (this.isRealGM() && !this.viewAsRole) return true;

    const matrix = this.viewAsRole ? this.viewAsPermisos : this.currentUser.permisos;
    const key = (componente || '').trim().toLowerCase();
    const row = matrix?.find((p) => (p.componente || '').toLowerCase() === key);
    if (row) {
      if (accion === 'ver') return !!(row.puedeVer || row.puedeEditar || row.puedeEliminar);
      if (accion === 'editar') return !!row.puedeEditar;
      return !!row.puedeEliminar;
    }
    return this.legacyCan(this.getEffectiveRole(), key, accion);
  }

  /**
   * Si no hay permiso, muestra un aviso y corta la acción.
   * Los botones deben seguir visibles (clase `.action-locked`) y clickeables.
   * @returns true si hay que abortar (sin permiso)
   */
  denyUnless(allowed: boolean, accion: string, event?: Event): boolean {
    if (allowed) {
      return false;
    }
    event?.preventDefault();
    event?.stopPropagation();
    this.notificationService.showWarning(
      'Sin permiso',
      `No tenés permiso para ${accion}.`
    );
    return true;
  }

  private legacyCan(role: string | null, componente: string, accion: 'ver' | 'editar' | 'eliminar'): boolean {
    const r = (role || '').toUpperCase();
    if (r === 'GM' || r === 'ADMIN') return true;
    const verAmplio = new Set([
      'terminales', 'dispositivos', 'inventario_activos', 'software', 'tickets',
      'compras', 'proveedores', 'almacenes', 'cementerio', 'almacen_laboratorio',
      'oficina_laboratorio',
      'internos_ose', 'stock'
    ]);
    if (accion === 'ver' && verAmplio.has(componente)) return true;
    if (r === 'INVENTARIO') {
      return ['terminales', 'dispositivos', 'inventario_activos', 'ubicaciones', 'tipos_activo', 'usuarios_responsables'].includes(componente);
    }
    if (r === 'ALMACEN') {
      if (componente === 'reactivar_transferir') return false;
      return ['almacenes', 'stock', 'planta_almacen', 'config_almacen', 'cementerio', 'almacen_laboratorio', 'oficina_laboratorio', 'estados_equipo'].includes(componente);
    }
    if (r === 'COMPRAS') return ['compras', 'proveedores'].includes(componente);
    if (r === 'GESTION_EQUIP') {
      return ['estados_equipo', 'cementerio', 'almacen_laboratorio', 'oficina_laboratorio', 'reactivar_transferir'].includes(componente);
    }
    if (componente === 'tickets') return accion !== 'eliminar';
    if (componente === 'internos_ose') return accion === 'ver';
    return false;
  }

  canManageUsers(): boolean {
    return this.isRealGM();
  }

  canConfirmAlerts(): boolean {
    return this.can('dashboard_acciones', 'editar');
  }

  canManageSoftware(): boolean {
    return this.can('software', 'editar');
  }

  canManageAssets(): boolean {
    return this.can('terminales', 'editar');
  }

  canManageWarehouseAssets(): boolean {
    return this.can('almacenes', 'editar') || this.can('stock', 'editar');
  }

  canManageEquipmentStates(): boolean {
    return this.can('estados_equipo', 'editar');
  }

  canTransferOrReactivateInCemeteryOrLabWarehouse(): boolean {
    return this.can('reactivar_transferir', 'editar');
  }

  canDeleteAssets(): boolean {
    return this.can('terminales', 'eliminar');
  }

  canDeleteDevices(): boolean {
    return this.can('dispositivos', 'eliminar');
  }

  canEditAssets(): boolean {
    return this.can('inventario_activos', 'editar');
  }

  canDeleteInventoryAssets(): boolean {
    return this.can('inventario_activos', 'eliminar');
  }

  canManagePurchases(): boolean {
    return this.can('compras', 'editar');
  }

  canManageLots(): boolean {
    return this.can('lotes', 'editar');
  }

  canManageDeliveries(): boolean {
    return this.can('entregas', 'editar');
  }

  canDeletePurchases(): boolean {
    return this.can('compras', 'eliminar');
  }

  canManageProviders(): boolean {
    return this.can('proveedores', 'editar');
  }

  canDeleteProviders(): boolean {
    return this.can('proveedores', 'eliminar');
  }

  canDeleteSoftware(): boolean {
    return this.can('software', 'eliminar');
  }

  canManageSubnets(): boolean {
    return this.can('subredes', 'editar');
  }

  canDeleteStock(): boolean {
    return this.can('stock', 'eliminar');
  }

  canDeleteTickets(): boolean {
    return this.can('tickets', 'eliminar');
  }

  canDeleteInternosOse(): boolean {
    return this.can('internos_ose', 'eliminar');
  }

  canAccessConfiguration(): boolean {
    return this.can('tipos_compra', 'ver') || this.isGM();
  }

  canAccessLocationsConfiguration(): boolean {
    return this.can('ubicaciones', 'ver');
  }

  canAccessTiposActivoConfiguration(): boolean {
    return this.can('tipos_activo', 'ver');
  }

  canAccessUsuariosResponsablesConfiguration(): boolean {
    return this.can('usuarios_responsables', 'ver');
  }

  canAccessWarehouseConfiguration(): boolean {
    return this.can('config_almacen', 'ver');
  }

  canAccessAdministrationMenu(): boolean {
    return this.isGM();
  }

  canUpdateNetworkDevices(): boolean {
    return this.can('dashboard_acciones', 'editar');
  }

  canAccessInternosOse(): boolean {
    return this.can('internos_ose', 'ver') || this.isLoggedIn();
  }

  canManageInternosOse(): boolean {
    return this.can('internos_ose', 'editar');
  }

  canAccessTickets(): boolean {
    return this.isLoggedIn();
  }

  canCreateTickets(): boolean {
    return this.isLoggedIn();
  }

  canProcessTicketsForArea(areaCodigo: string): boolean {
    if (!this.currentUser || !areaCodigo) return false;
    if (this.can('tickets_globales', 'editar') || this.isGM()) return true;
    const asignada = (this.currentUser.areaCodigo || this.currentUser.ticketAreaCodigo || this.getEffectiveRole() || '')
      .trim().toUpperCase();
    return !!asignada && asignada === areaCodigo.trim().toUpperCase();
  }

  getTicketAreaCodigo(): string | null {
    const fromArea = this.currentUser?.areaCodigo;
    if (fromArea?.trim()) return fromArea.trim().toUpperCase();
    const c = this.currentUser?.ticketAreaCodigo;
    return c?.trim() ? c.trim().toUpperCase() : null;
  }

  hasUserTicketBandeja(): boolean {
    return !!this.getTicketAreaCodigo() && !this.isGM();
  }

  canManageTicketBandejas(): boolean {
    return this.can('config_flujos', 'editar');
  }

  canManageAreas(): boolean {
    return this.isRealGM();
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
} 