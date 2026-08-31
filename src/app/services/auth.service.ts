import { Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError, switchMap, map } from 'rxjs';
import { LoginRequest, AuthResponse, User, CreateUserRequest, UpdateUserRequest, UpdateProfileRequest, ContactoUsuario } from '../interfaces/auth.interface';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';
import { PermissionsService } from './permissions.service';
import { Router } from '@angular/router';
import { SessionIdleService } from './session-idle.service';
import { OcsDuplicatesAlertService } from './ocs-duplicates-alert.service';
import { UnreadTicketsService } from './unread-tickets.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isRefreshing = false;
  /** Cache-bust de la URL de avatar (img src no pasa por HttpClient). */
  private avatarCacheBust = Date.now();

  constructor(
    private http: HttpClient,
    private permissionsService: PermissionsService,
    private router: Router,
    private injector: Injector
  ) {
    this.loadUserFromStorage();
    // Iniciar monitoreo automático de tokens
    this.startTokenMonitoring();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          if (response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('refreshToken', response.refreshToken);
            this.currentUserSubject.next(response.user);
            // Update permissions service
            this.permissionsService.setCurrentUser(response.user);
            this.bumpAvatarCache();
            this.notifyHelperDogLoginChecks();
          }
        })
      );
  }

  /** Globos del helper-dog al iniciar sesión (tickets + duplicados OCS). */
  private notifyHelperDogLoginChecks(): void {
    queueMicrotask(() => {
      try {
        this.injector.get(UnreadTicketsService).scheduleLoginCheck();
      } catch {
        /* opcional */
      }
      try {
        this.injector.get(OcsDuplicatesAlertService).scheduleLoginCheck();
      } catch {
        /* opcional */
      }
    });
  }

  /**
   * Registro público: el backend crea el usuario como USER deshabilitado (pendiente de aprobación).
   * No almacena token en el cliente hasta que un administrador habilite la cuenta.
   */
  registerPublic(payload: CreateUserRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, {
      ...payload,
      role: payload.role || 'USER'
    });
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    this.currentUserSubject.next(null);
    this.permissionsService.clearCurrentUser();
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = this.decodeJwtPayload(token);
      if (!payload?.exp) {
        return false;
      }
      return new Date(payload.exp * 1000) > new Date();
    } catch (error) {
      console.error('Error verificando token:', error);
      return false;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtiene el identificador del usuario actual para auditoría (estado de equipos, traslados, etc.).
   * Usa nombre completo si está disponible, si no username, o 'Sistema' si no hay sesión.
   */
  getUsuarioParaAuditoria(): string {
    const user = this.getCurrentUser();
    if (!user) return 'Sistema';
    const nombreCompleto = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return nombreCompleto || user.username || 'Usuario';
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  isGM(): boolean {
    return this.hasRole('GM');
  }

  isAdmin(): boolean {
    return this.hasRole('ADMIN') || this.hasRole('GM');
  }

  // Método para renovar el token usando refresh token
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No hay refresh token disponible'));
    }

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap(response => {
          if (response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('refreshToken', response.refreshToken);
            this.currentUserSubject.next(response.user);
            this.permissionsService.setCurrentUser(response.user);
            this.notifyHelperDogLoginChecks();
          }
        }),
        catchError(error => {
          console.error('Error renovando token:', error);
          this.logout();
          return throwError(() => error);
        })
      );
  }

  // Método para verificar si el token está próximo a expirar (5 minutos antes)
  isTokenExpiringSoon(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = this.decodeJwtPayload(token);
      if (!payload?.exp) {
        return true;
      }
      const expirationDate = new Date(payload.exp * 1000);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      return expirationDate <= fiveMinutesFromNow;
    } catch (error) {
      console.error('Error verificando expiración del token:', error);
      return true;
    }
  }

  /**
   * Verifica si el token actual está expirado
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = this.decodeJwtPayload(token);
      if (!payload?.exp) {
        return true;
      }
      return new Date(payload.exp * 1000) <= new Date();
    } catch (error) {
      console.error('Error verificando expiración del token:', error);
      return true;
    }
  }

  /**
   * Limpia completamente la sesión del usuario
   */
  clearSession(): void {
    console.log('🔄 Limpiando sesión completamente...');
    
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('cerberoGmViewAsRole');
    
    // Limpiar sessionStorage
    sessionStorage.clear();
    
    // Limpiar cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Limpiar estado interno
    this.currentUserSubject.next(null);
    this.permissionsService.clearCurrentUser();
    
    console.log('✅ Sesión limpiada completamente');
  }

  // Método para verificar el token con el backend
  verifyToken(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/verify`);
  }

  /**
   * Maneja el caso cuando la base de datos ha sido reseteada
   * Este método debe ser llamado cuando se detectan errores 401 consistentes
   */
  handleDatabaseReset(): void {
    console.log('🔄 Base de datos reseteada detectada - limpiando sesión');
    
    // Limpiar toda la información de sesión
    this.logout();
    
    // Limpiar también el localStorage por si acaso
    localStorage.clear();
    
    // Emitir evento de reseteo de base de datos
    this.currentUserSubject.next(null);
    this.permissionsService.clearCurrentUser();

    // Redirigir al login
    this.router.navigate(['/login']);
    alert('La base de datos ha sido reseteada. Por favor, inicie sesión nuevamente.');
  }

  /**
   * Verifica si el usuario actual existe en la base de datos
   * Útil para detectar si la base de datos ha sido reseteada
   */
  verifyCurrentUserExists(): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('No hay usuario autenticado'));
    }
    
    return this.http.get(`${this.apiUrl}/auth/verify`).pipe(
      tap(() => console.log('Usuario verificado exitosamente')),
      catchError(error => {
        if (error.status === 401 || error.status === 404) {
          console.log('Usuario no encontrado en la base de datos - posible reseteo');
          this.handleDatabaseReset();
        }
        return throwError(() => error);
      })
    );
  }

  // Método para iniciar el monitoreo automático de tokens
  startTokenMonitoring(): void {
    setInterval(() => {
      if (!this.shouldAutoRefreshToken()) {
        return;
      }
      if (this.isTokenExpiringSoon() && this.getRefreshToken()) {
        this.refreshToken().subscribe({
          error: () => {
            /* logout ya manejado en refreshToken */
          }
        });
      }
    }, 5 * 60 * 1000);
  }

  /** No renovar JWT si el usuario lleva 30+ min sin actividad (cierre por inactividad). */
  private shouldAutoRefreshToken(): boolean {
    try {
      return this.injector.get(SessionIdleService).shouldAllowTokenRefresh();
    } catch {
      return true;
    }
  }

  private decodeJwtPayload(token: string): {
    exp?: number;
    sub?: string;
    id?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    enabled?: boolean;
  } {
    const segment = token.split('.')[1];
    if (!segment) {
      throw new Error('JWT sin payload');
    }
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const json = decodeURIComponent(
      Array.from(atob(padded), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    );
    return JSON.parse(json);
  }

  private loadUserFromStorage(): void {
    const token = this.getToken();
    
    if (token && this.isAuthenticated()) {
      // Decodificar el token JWT para obtener la información del usuario
      try {
        const payload = this.decodeJwtPayload(token);
        
        const user: User = {
          id: payload.id || 0,
          username: payload.sub || '',
          email: payload.email || '',
          firstName: payload.firstName || '',
          lastName: payload.lastName || '',
          role: payload.role || '',
          enabled: payload.enabled || true
        };
        try {
          const stored = localStorage.getItem('currentUser');
          if (stored) {
            const parsed = JSON.parse(stored) as User;
            if (parsed && parsed.id === user.id) {
              user.hasAvatar = !!parsed.hasAvatar;
              user.ticketAreaCodigo = parsed.ticketAreaCodigo;
              user.createdAt = parsed.createdAt;
            }
          }
        } catch {
          /* localStorage corrupto: seguir con el JWT */
        }
        this.currentUserSubject.next(user);
        this.permissionsService.setCurrentUser(user);
        this.notifyHelperDogLoginChecks();
        queueMicrotask(() => this.refreshCurrentUserFromApi());
      } catch (error) {
        console.error('Error decoding token:', error);
        this.logout();
      }
    } else if (token) {
      // Token existe pero está expirado, intentar renovar
      console.log('Token expirado, intentando renovar...');
      this.refreshToken().subscribe({
        next: () => console.log('Token renovado exitosamente'),
        error: () => {
          console.log('No se pudo renovar el token, cerrando sesión');
          this.logout();
        }
      });
    }
  }

  // Métodos para gestión de usuarios (solo GM y Admin)
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/gm/users`);
  }

  createUser(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/gm/users`, userData);
  }

  updateUser(id: number, userData: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/gm/users/${id}`, userData)
      .pipe(
        tap(response => {
        }),
        catchError(error => {
          console.error('AuthService: Update error:', error);
          throw error;
        })
      );
  }

  updateProfile(profileData: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/auth/profile`, profileData)
      .pipe(
        tap(response => {
          console.log('AuthService: Profile updated successfully:', response);
        }),
        catchError(error => {
          console.error('AuthService: Profile update error:', error);
          throw error;
        })
      );
  }

  updateCurrentUser(updatedUser: User): void {
    this.currentUserSubject.next(updatedUser);
    this.permissionsService.setCurrentUser(updatedUser);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/gm/users/${id}`);
  }

  getCurrentUserProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/profile`);
  }

  /** Guía de contactos: usuarios habilitados de la app (sin contraseña). */
  getDirectorioUsuarios(): Observable<ContactoUsuario[]> {
    return this.http.get<ApiResponse<ContactoUsuario[]>>(`${this.apiUrl}/users/directorio`).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'No se pudo cargar el directorio');
        }
        return res.data ?? [];
      })
    );
  }

  /** URL autenticada para <img src> (?token=; el interceptor no aplica a src). */
  getAvatarUrl(userId?: number): string {
    const token = this.getToken();
    const path = userId != null
      ? `${this.apiUrl}/users/${userId}/avatar`
      : `${this.apiUrl}/users/profile/avatar`;
    let url = `${path}?t=${this.avatarCacheBust}`;
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    return url;
  }

  bumpAvatarCache(): void {
    this.avatarCacheBust = Date.now();
  }

  uploadAvatar(file: File): Observable<User> {
    const form = new FormData();
    form.append('archivo', file);
    return this.http.post<ApiResponse<User>>(`${this.apiUrl}/users/profile/avatar`, form).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.bumpAvatarCache();
          this.updateCurrentUser(res.data);
        }
      }),
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'No se pudo subir la foto');
        }
        return res.data;
      })
    );
  }

  deleteAvatar(): Observable<User> {
    return this.http.delete<ApiResponse<User>>(`${this.apiUrl}/users/profile/avatar`).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.bumpAvatarCache();
          this.updateCurrentUser(res.data);
        }
      }),
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'No se pudo quitar la foto');
        }
        return res.data;
      })
    );
  }

  private refreshCurrentUserFromApi(): void {
    if (!this.getToken() || !this.isAuthenticated()) {
      return;
    }
    this.getCurrentUserProfile().subscribe({
      next: (profile) => {
        const current = this.getCurrentUser();
        const { password: _ignored, ...safe } = profile;
        this.updateCurrentUser({ ...(current || {}), ...safe });
      },
      error: () => {
        /* mantener el usuario del JWT */
      }
    });
  }
} 