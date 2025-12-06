import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MaintenanceService } from '../services/maintenance.service';

/**
 * Guard que bloquea la navegación cuando el modo mantenimiento está activo.
 * Verifica el estado local del servicio de mantenimiento.
 */
export const maintenanceGuard: CanActivateFn = (route, state) => {
  const maintenanceService = inject(MaintenanceService);
  const router = inject(Router);

  // Si el modo mantenimiento está activo, bloquear navegación
  if (maintenanceService.isMaintenanceModeActive()) {
    console.log('🔧 Navegación bloqueada - Sistema en mantenimiento');
    // No redirigir, solo bloquear - el overlay se mostrará automáticamente
    return false;
  }

  return true;
};

