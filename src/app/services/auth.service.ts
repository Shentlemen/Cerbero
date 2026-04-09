import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError, switchMap } from 'rxjs';
import { LoginRequest, AuthResponse, User, CreateUserRequest, UpdateUserRequest, UpdateProfileRequest } from '../interfaces/auth.interface';
import { environment } from '../../environments/environment';
import { PermissionsService } from './permissions.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isRefreshing = false;

  constructor(
    private http: HttpClient,
    private permissionsService: PermissionsService,
    private router: Router
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
          }
        })
      );
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
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationDate = new Date(payload.exp * 1000);
      return expirationDate > new Date();
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
      const payload = JSON.parse(atob(token.split('.')[1]));
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
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationDate = new Date(payload.exp * 1000);
      return expirationDate <= new Date();
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
    // Verificar cada 5 minutos si el token está próximo a expirar
    setInterval(() => {
      if (this.isTokenExpiringSoon() && this.getRefreshToken()) {
        console.log('Token próximo a expirar, renovando automáticamente...');
        this.refreshToken().subscribe({
          next: () => console.log('Token renovado automáticamente'),
          error: (error) => console.error('Error renovando token automáticamente:', error)
        });
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  private loadUserFromStorage(): void {
    const token = this.getToken();
    
    if (token && this.isAuthenticated()) {
      // Decodificar el token JWT para obtener la información del usuario
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        const user: User = {
          id: payload.id || 0,
          username: payload.sub,
          email: payload.email || '',
          firstName: payload.firstName || '',
          lastName: payload.lastName || '',
          role: payload.role || '',
          enabled: payload.enabled || true
        };
        this.currentUserSubject.next(user);
        this.permissionsService.setCurrentUser(user);
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
} 