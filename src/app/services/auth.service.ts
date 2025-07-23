import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError } from 'rxjs';
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

  constructor(
    private http: HttpClient,
    private permissionsService: PermissionsService
  ) {
    this.loadUserFromStorage();
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
    return !!this.getToken();
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

  private loadUserFromStorage(): void {
    const token = this.getToken();
    
    if (token) {
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
    } else {
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

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/gm/users/${id}`);
  }

  getCurrentUserProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/profile`);
  }
} 