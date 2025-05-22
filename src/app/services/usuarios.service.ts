import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map, catchError } from 'rxjs/operators';

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
        this.apiUrl = `${this.configService.getApiUrl()}/usuarios`;
    }

    private handleError(error: HttpErrorResponse) {
        let errorMessage = 'Ha ocurrido un error en la operación';
        
        if (error.error instanceof ErrorEvent) {
            // Error del cliente
            errorMessage = error.error.message;
        } else {
            // Error del servidor
            if (error.error && error.error.message) {
                errorMessage = error.error.message;
            } else {
                switch (error.status) {
                    case 404:
                        errorMessage = 'El usuario no fue encontrado';
                        break;
                    case 400:
                        errorMessage = 'Datos inválidos para el usuario';
                        break;
                    case 500:
                        errorMessage = 'Error interno del servidor';
                        break;
                }
            }
        }
        
        return throwError(() => new Error(errorMessage));
    }

    // Obtener todos los usuarios
    getUsuarios(): Observable<UsuarioDTO[]> {
        return this.http.get<ApiResponse<UsuarioDTO[]>>(this.apiUrl).pipe(
            map(response => {
                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.message);
                }
            }),
            catchError(this.handleError)
        );
    }

    // Obtener usuario por ID
    getUsuario(id: number): Observable<UsuarioDTO> {
        return this.http.get<ApiResponse<UsuarioDTO>>(`${this.apiUrl}/${id}`).pipe(
            map(response => {
                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.message);
                }
            }),
            catchError(this.handleError)
        );
    }

    // Obtener usuario por cédula
    getUsuarioByCedula(cedula: string): Observable<UsuarioDTO> {
        return this.http.get<ApiResponse<UsuarioDTO>>(`${this.apiUrl}/by-cedula/${cedula}`).pipe(
            map(response => {
                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.message);
                }
            }),
            catchError(this.handleError)
        );
    }

    // Obtener usuarios por unidad
    getUsuariosByUnidad(unidad: string): Observable<UsuarioDTO[]> {
        return this.http.get<ApiResponse<UsuarioDTO[]>>(`${this.apiUrl}/by-unidad/${unidad}`).pipe(
            map(response => {
                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.message);
                }
            }),
            catchError(this.handleError)
        );
    }

    // Obtener usuarios por cargo
    getUsuariosByCargo(cargo: string): Observable<UsuarioDTO[]> {
        return this.http.get<ApiResponse<UsuarioDTO[]>>(`${this.apiUrl}/by-cargo/${cargo}`).pipe(
            map(response => {
                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.message);
                }
            }),
            catchError(this.handleError)
        );
    }

    // Crear nuevo usuario
    crearUsuario(usuario: Omit<UsuarioDTO, 'idUsuario'>): Observable<UsuarioDTO> {
        return this.http.post<ApiResponse<UsuarioDTO>>(this.apiUrl, usuario).pipe(
            map(response => {
                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.message);
                }
            }),
            catchError(this.handleError)
        );
    }

    // Actualizar usuario
    actualizarUsuario(idUsuario: number, usuario: UsuarioDTO): Observable<UsuarioDTO> {
        // Aseguramos que el idUsuario coincida con el de la URL
        const usuarioActualizado = {
            ...usuario,
            idUsuario: idUsuario
        };

        return this.http.put<ApiResponse<UsuarioDTO>>(`${this.apiUrl}/${idUsuario}`, usuarioActualizado).pipe(
            map(response => {
                if (response.success) {
                    return response.data;
                } else {
                    throw new Error(response.message);
                }
            }),
            catchError(this.handleError)
        );
    }

    // Eliminar usuario
    eliminarUsuario(id: number): Observable<void> {
        return this.http.delete(`${this.apiUrl}/${id}`, { observe: 'response' }).pipe(
            map(response => {
                // Si la respuesta es 204 (No Content), consideramos que fue exitosa
                if (response.status === 204) {
                    return;
                }
                // Si hay una respuesta con cuerpo, verificamos el success
                const apiResponse = response.body as ApiResponse<null>;
                if (apiResponse && !apiResponse.success) {
                    throw new Error(apiResponse.message);
                }
            }),
            catchError(this.handleError)
        );
    }
} 