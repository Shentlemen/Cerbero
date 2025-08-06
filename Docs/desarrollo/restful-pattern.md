# 🔄 Patrón RESTful para Servicios

## 📋 Descripción General

Este documento describe el patrón RESTful implementado en el proyecto Cerbero para manejar la comunicación con los endpoints de manera consistente y eficiente.

## 🏗️ Arquitectura

### BaseRestService

El `BaseRestService` es una clase abstracta que proporciona métodos genéricos para todas las operaciones CRUD RESTful:

```typescript
export abstract class BaseRestService {
  protected abstract apiUrl: string;

  // Métodos genéricos
  protected get<T>(endpoint?: string): Observable<T>
  protected getList<T>(endpoint?: string, params?: any): Observable<T[]>
  protected getById<T>(id: number | string, endpoint?: string): Observable<T>
  protected post<T>(data: any, endpoint?: string): Observable<T>
  protected put<T>(id: number | string, data: any, endpoint?: string): Observable<T>
  protected delete<T>(id: number | string, endpoint?: string): Observable<T>
  protected patch<T>(id: number | string, data: any, endpoint?: string): Observable<T>
}
```

## 📝 Implementación de Servicios

### 1. Estructura Básica

```typescript
@Injectable({
  providedIn: 'root'
})
export class MiServicioService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/mi-recurso`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }
}
```

### 2. Métodos CRUD Estándar

```typescript
// GET - Obtener todos
getAll(): Observable<MiEntidad[]> {
  return this.getList<MiEntidad>();
}

// GET - Obtener por ID
getById(id: number): Observable<MiEntidad> {
  return this.getById<MiEntidad>(id);
}

// POST - Crear
create(data: MiEntidadCreate): Observable<MiEntidad> {
  return this.post<MiEntidad>(data).pipe(
    map(result => {
      this.showSuccessMessage('Elemento creado exitosamente');
      return result;
    })
  );
}

// PUT - Actualizar
update(id: number, data: MiEntidad): Observable<void> {
  return this.put<void>(id, data).pipe(
    map(result => {
      this.showSuccessMessage('Elemento actualizado exitosamente');
      return result;
    })
  );
}

// DELETE - Eliminar
delete(id: number): Observable<void> {
  return this.delete<void>(id).pipe(
    map(result => {
      this.showSuccessMessage('Elemento eliminado exitosamente');
      return result;
    })
  );
}
```

### 3. Métodos Personalizados

```typescript
// GET con parámetros
searchByTerm(term: string): Observable<MiEntidad[]> {
  return this.getList<MiEntidad>('search', { term });
}

// GET con endpoint personalizado
getStats(): Observable<any> {
  return this.get<any>('stats');
}

// POST con endpoint personalizado
bulkCreate(data: MiEntidadCreate[]): Observable<MiEntidad[]> {
  return this.post<MiEntidad[]>('bulk', data);
}
```

## 🎯 Ventajas del Patrón

### 1. **Consistencia**
- Todos los servicios manejan las respuestas de la misma manera
- Manejo de errores estandarizado
- Notificaciones automáticas de éxito/error

### 2. **Mantenibilidad**
- Código DRY (Don't Repeat Yourself)
- Cambios centralizados en el manejo de respuestas
- Fácil testing y debugging

### 3. **Escalabilidad**
- Fácil agregar nuevos servicios
- Métodos genéricos reutilizables
- Extensibilidad para casos especiales

### 4. **Experiencia de Usuario**
- Notificaciones automáticas
- Manejo de errores consistente
- Feedback inmediato al usuario

## 🔧 Manejo de Respuestas

### Estructura de Respuesta

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
```

### Manejo Automático

El `BaseRestService` maneja automáticamente:

1. **Respuestas exitosas**: Extrae `data` de la respuesta
2. **Respuestas de error**: Muestra notificación y lanza error
3. **Errores HTTP**: Maneja códigos de estado específicos
4. **Notificaciones**: Muestra mensajes de éxito/error automáticamente

## 📊 Ejemplos de Uso

### Servicio de Almacenes

```typescript
@Injectable({
  providedIn: 'root'
})
export class AlmacenService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/almacenes`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }

  getAllAlmacenes(): Observable<Almacen[]> {
    return this.getList<Almacen>();
  }

  createAlmacen(almacen: Omit<Almacen, 'id'>): Observable<Almacen> {
    return this.post<Almacen>(almacen).pipe(
      map(result => {
        this.showSuccessMessage('Almacén creado exitosamente');
        return result;
      })
    );
  }
}
```

### Componente que usa el Servicio

```typescript
export class AlmacenesComponent {
  cargarAlmacenes(): void {
    this.loading = true;
    
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes) => {
        this.almacenes = almacenes;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.loading = false;
      }
    });
  }

  guardarAlmacen(): void {
    this.almacenService.createAlmacen(this.almacenForm.value).subscribe({
      next: () => {
        this.modalService.dismissAll();
        this.cargarAlmacenes();
      },
      error: (error) => {
        console.error('Error:', error);
      }
    });
  }
}
```

## 🚨 Manejo de Errores

### Errores Automáticos

El servicio maneja automáticamente:

- **400**: Solicitud inválida
- **401**: No autorizado
- **403**: Acceso denegado
- **404**: Recurso no encontrado
- **409**: Conflicto de datos
- **422**: Datos de validación incorrectos
- **500**: Error interno del servidor

### Personalización de Errores

```typescript
// En el servicio
protected handleError(error: HttpErrorResponse, context: string = 'Operación'): Observable<never> {
  // Lógica personalizada de manejo de errores
  return super.handleError(error, context);
}
```

## 🔄 Migración de Servicios Existentes

### Antes (Patrón Anterior)

```typescript
export class MiServicioService {
  getAll(): Observable<ApiResponse<MiEntidad[]>> {
    return this.http.get<ApiResponse<MiEntidad[]>>(this.apiUrl);
  }

  create(data: any): Observable<ApiResponse<MiEntidad>> {
    return this.http.post<ApiResponse<MiEntidad>>(this.apiUrl, data);
  }
}
```

### Después (Patrón RESTful)

```typescript
export class MiServicioService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/mi-recurso`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }

  getAll(): Observable<MiEntidad[]> {
    return this.getList<MiEntidad>();
  }

  create(data: any): Observable<MiEntidad> {
    return this.post<MiEntidad>(data).pipe(
      map(result => {
        this.showSuccessMessage('Elemento creado exitosamente');
        return result;
      })
    );
  }
}
```

## 📋 Checklist de Implementación

- [ ] Extender `BaseRestService`
- [ ] Definir `apiUrl` protegida
- [ ] Inyectar `HttpClient` y `NotificationService`
- [ ] Implementar métodos CRUD usando métodos genéricos
- [ ] Agregar mensajes de éxito personalizados
- [ ] Actualizar componentes para usar nuevos métodos
- [ ] Probar manejo de errores
- [ ] Verificar notificaciones automáticas

## 🎯 Mejores Prácticas

1. **Usar tipos genéricos**: Siempre especificar el tipo de retorno
2. **Mensajes descriptivos**: Usar mensajes claros en notificaciones
3. **Manejo de errores**: Dejar que el servicio base maneje errores comunes
4. **Consistencia**: Seguir el mismo patrón en todos los servicios
5. **Testing**: Probar tanto casos exitosos como de error

## 🔗 Referencias

- [BaseRestService](../src/app/services/base-rest.service.ts)
- [ApiResponse Interface](../src/app/interfaces/api-response.interface.ts)
- [AlmacenService Example](../src/app/services/almacen.service.ts)
- [ActivoAlmacenService Example](../src/app/services/activo-almacen.service.ts) 