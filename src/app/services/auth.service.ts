import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError, switchMap } from 'rxjs';
import { LoginRequest, AuthResponse, User, CreateUserRequest, UpdateUserRequest } from '../interfaces/auth.interface';
import { environment } from '../../environments/environment';
import { PermissionsService } from './permissions.service';

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
    private permissionsService: PermissionsService
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

  // Método para verificar el token con el backend
  verifyToken(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/verify`);
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