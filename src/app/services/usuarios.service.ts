import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface UsuarioDTO {
    idUsuario: number;
    cedula: string;
    nombre: string;
    apellido: string;
    cargo: string;
    unidad: string;
    email: string;
    telefono: string;
}

@Injectable({
    providedIn: 'root'
})
export class UsuariosService {
    private apiUrl: string;

    constructor(
        private http: HttpClient,
        private configService: ConfigService
    ) {
        this.apiUrl = this.configService.getApiUrl();
    }

    // Obtener todos los usuarios
    getUsuarios(): Observable<UsuarioDTO[]> {
        return this.http.get<UsuarioDTO[]>(`${this.apiUrl}/usuarios`);
    }

    // Obtener usuario por ID
    getUsuario(id: number): Observable<UsuarioDTO> {
        return this.http.get<UsuarioDTO>(`${this.apiUrl}/usuarios/${id}`);
    }

    // Obtener usuario por cédula
    getUsuarioByCedula(cedula: string): Observable<UsuarioDTO> {
        return this.http.get<UsuarioDTO>(`${this.apiUrl}/usuarios/by-cedula/${cedula}`);
    }

    // Obtener usuarios por unidad
    getUsuariosByUnidad(unidad: string): Observable<UsuarioDTO[]> {
        return this.http.get<UsuarioDTO[]>(`${this.apiUrl}/usuarios/by-unidad/${unidad}`);
    }

    // Obtener usuarios por cargo
    getUsuariosByCargo(cargo: string): Observable<UsuarioDTO[]> {
        return this.http.get<UsuarioDTO[]>(`${this.apiUrl}/usuarios/by-cargo/${cargo}`);
    }

    // Crear nuevo usuario
    crearUsuario(usuario: Omit<UsuarioDTO, 'idUsuario'>): Observable<string> {
        return this.http.post<string>(`${this.apiUrl}/usuarios`, usuario);
    }

    // Actualizar usuario
    actualizarUsuario(id: number, usuario: UsuarioDTO): Observable<string> {
        return this.http.put<string>(`${this.apiUrl}/usuarios/${id}`, usuario);
    }

    // Eliminar usuario
    eliminarUsuario(id: number): Observable<string> {
        return this.http.delete<string>(`${this.apiUrl}/usuarios/${id}`);
    }
} 