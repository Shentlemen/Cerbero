import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ActivosService, ActivoDTO } from '../../../services/activos.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { EntregasService, EntregaDTO } from '../../../services/entregas.service';
import { UbicacionesService } from '../../../services/ubicaciones.service';
import { UbicacionDTO } from '../../../interfaces/ubicacion.interface';
import { UsuariosService, UsuarioDTO } from '../../../services/usuarios.service';
import { TiposActivoService, TipoDeActivoDTO } from '../../../services/tipos-activo.service';
import { ComprasService, CompraDTO } from '../../../services/compras.service';
import { LotesService, LoteDTO } from '../../../services/lotes.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../../services/servicios-garantia.service';
import { HardwareService } from '../../../services/hardware.service';
import { forkJoin } from 'rxjs';
import { TiposCompraService } from '../../../services/tipos-compra.service';
import { NotificationService } from '../../../services/notification.service';
import { NotificationContainerComponent } from '../../../components/notification-container/notification-container.component';

@Component({
  selector: 'app-activo-details',
  standalone: true,
  imports: [CommonModule, NgbModule, NotificationContainerComponent],
  templateUrl: './activo-details.component.html',
  styleUrls: ['./activo-details.component.css']
})
export class ActivoDetailsComponent implements OnInit {
  activo: ActivoDTO | null = null;
  entregaSeleccionada: EntregaDTO | null = null;
  ubicacionSeleccionada: UbicacionDTO | null = null;
  usuarioSeleccionado: UsuarioDTO | null = null;
  tipoActivoSeleccionado: TipoDeActivoDTO | null = null;
  usuarioResponsable: UsuarioDTO | null = null;
  compraSeleccionada: CompraDTO | null = null;
  loteSeleccionado: LoteDTO | null = null;
  servicioGarantiaSeleccionado: ServicioGarantiaDTO | null = null;
  servicioGarantiaInfo: string = '';
  loading: boolean = false;
  error: string | null = null;
  ubicacionInfo: string = '';
  usuarioInfo: string = '';
  tipoActivoInfo: string = '';
  hardwareName: string = '';
  previousUrl: string = '';
  activosRelacionados: ActivoDTO[] = [];
  loadingRelacionados: boolean = false;
  errorRelacionados: string | null = null;
  private tipoActivoMap: Map<number, string> | null = null;
  numeroCompraInfo: string = '';
  tipoCompraDescripcion: string = '';
  nombreItemInfo: string = '';
  numeroCompraLoteInfo: string = '';
  nombreComercialServicioInfo: string = '';
  descripcionEntregaInfo: string = '';
  nombreItemEntregaInfo: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private activosService: ActivosService,
    private entregasService: EntregasService,
    private ubicacionesService: UbicacionesService,
    private usuariosService: UsuariosService,
    private tiposActivoService: TiposActivoService,
    private comprasService: ComprasService,
    private lotesService: LotesService,
    private serviciosGarantiaService: ServiciosGarantiaService,
    private modalService: NgbModal,
    private hardwareService: HardwareService,
    private tiposCompraService: TiposCompraService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cargarActivo(parseInt(id));
      }
    });
  }

  cargarActivo(id: number) {
    this.loading = true;
    this.error = null;
    this.activosService.getActivo(id).subscribe({
      next: (activo) => {
        console.log('Respuesta del activo:', activo);
        this.activo = activo;
        if (this.activo) {
          if (this.activo.idUbicacion !== null && this.activo.idUbicacion !== undefined) {
            this.cargarUbicacionInfo(this.activo.idUbicacion);
          } else {
            this.ubicacionInfo = 'No asignada';
          }
          this.cargarUsuarioInfo(this.activo.idUsuario);
          this.cargarTipoActivoInfo(this.activo.idTipoActivo);
          this.cargarServicioGarantiaInfo(this.activo.idServicioGarantia);
          this.hardwareName = this.activo.name || '';
          this.cargarActivosRelacionados(this.activo.idActivo);
          this.cargarNumeroCompraInfo(this.activo.idNumeroCompra);
          this.cargarNombreItemInfo(this.activo.idItem);
          this.cargarDescripcionEntregaInfo(this.activo.idEntrega);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar activo:', error);
        this.error = 'Error al cargar los detalles del activo';
        this.loading = false;
      }
    });
  }

  cargarActivosRelacionados(idActivo: number): void {
    this.loadingRelacionados = true;
    this.errorRelacionados = null;
    this.activosRelacionados = [];
    
    this.activosService.getActivosRelacionados(idActivo).subscribe({
      next: (ids: number[]) => {
        if (ids && ids.length > 0) {
          // Hacer llamadas individuales para cada activo relacionado
          const cargasActivos = ids.map(id => 
            this.activosService.getActivo(id)
          );

          // Usar forkJoin para manejar múltiples observables
          forkJoin(cargasActivos).subscribe({
            next: (activos) => {
              this.activosRelacionados = activos.filter(activo => activo !== null);
              
              // Cargar información del tipo de activo para cada activo relacionado
              this.activosRelacionados.forEach(activo => {
                if (activo.idTipoActivo) {
                  this.cargarTipoActivoInfoRelacionado(activo.idTipoActivo, activo.idActivo);
                }
              });
              
              this.loadingRelacionados = false;
            },
            error: (error) => {
              console.error('Error al cargar detalles de activos relacionados:', error);
              this.errorRelacionados = 'No se pudieron cargar los detalles de los activos relacionados';
              this.activosRelacionados = [];
              this.loadingRelacionados = false;
            }
          });
        } else {
          this.activosRelacionados = [];
          this.loadingRelacionados = false;
        }
      },
      error: (error) => {
        console.error('Error al cargar IDs de activos relacionados:', error);
        this.errorRelacionados = 'No se pudieron cargar los activos relacionados';
        this.activosRelacionados = [];
        this.loadingRelacionados = false;
      }
    });
  }

  cargarTipoActivoInfoRelacionado(idTipoActivo: number, idActivo: number): void {
    this.tiposActivoService.getTipoActivo(idTipoActivo).subscribe({
      next: (tipoActivo) => {
        if (tipoActivo) {
          const activo = this.activosRelacionados.find(a => a.idActivo === idActivo);
          if (activo) {
            // Usar un Map para almacenar las descripciones de los tipos de activo
            if (!this.tipoActivoMap) {
              this.tipoActivoMap = new Map();
            }
            this.tipoActivoMap.set(idActivo, tipoActivo.descripcion);
          }
        }
      },
      error: (error) => {
        console.error('Error al cargar información del tipo de activo:', error);
      }
    });
  }

  getTipoActivoDescripcion(activo: ActivoDTO): string {
    return this.tipoActivoMap?.get(activo.idActivo) || 'Tipo de activo no disponible';
  }

  verDetallesActivoRelacionado(idActivoRelacionado: number): void {
    // Navegar a la nueva ruta y recargar los datos
    this.router.navigate(['/menu/procurement/activos', idActivoRelacionado])
      .then(() => {
        // Recargar los datos del nuevo activo
        this.cargarActivo(idActivoRelacionado);
      });
  }

  verDetallesActivo(idActivo: number): void {
    this.router.navigate(['/menu/procurement/activos', idActivo]);
  }

  cargarUbicacionInfo(idUbicacion: number) {
    this.ubicacionesService.getUbicacionEquipo(idUbicacion).subscribe({
      next: (ubicacion: UbicacionDTO) => {
        this.ubicacionSeleccionada = ubicacion;
        this.ubicacionInfo = `${ubicacion.nombreGerencia} - ${ubicacion.nombreOficina}`;
      },
      error: (error: any) => {
        this.ubicacionInfo = 'No disponible';
        console.error('Error al cargar la información de la ubicación:', error);
      }
    });
  }

  cargarUsuarioInfo(idUsuario: number) {
    this.usuariosService.getUsuario(idUsuario).subscribe({
      next: (usuario) => {
        this.usuarioSeleccionado = usuario;
        this.usuarioInfo = `${usuario.nombre} ${usuario.apellido}`;
      },
      error: (error) => {
        this.usuarioInfo = 'No disponible';
        console.error('Error al cargar la información del usuario:', error);
      }
    });
  }

  cargarTipoActivoInfo(idTipoActivo: number) {
    this.tiposActivoService.getTipoActivo(idTipoActivo).subscribe({
      next: (tipoActivo) => {
        this.tipoActivoSeleccionado = tipoActivo;
        this.cargarUsuarioResponsable(tipoActivo.idUsuario);
        this.tipoActivoInfo = tipoActivo.descripcion;
      },
      error: (error) => {
        this.tipoActivoInfo = 'No disponible';
        console.error('Error al cargar la información del tipo de activo:', error);
      }
    });
  }

  cargarUsuarioResponsable(idUsuario: number) {
    this.usuariosService.getUsuario(idUsuario).subscribe({
      next: (usuario) => {
        this.usuarioResponsable = usuario;
      },
      error: (error) => {
        console.error('Error al cargar la información del usuario responsable:', error);
      }
    });
  }

  cargarServicioGarantiaInfo(idServicioGarantia: number) {
    this.serviciosGarantiaService.getServicioGarantia(idServicioGarantia).subscribe({
      next: (servicio) => {
        this.servicioGarantiaSeleccionado = servicio;
        this.servicioGarantiaInfo = servicio.nombreComercial;
      },
      error: (error) => {
        this.servicioGarantiaInfo = 'No disponible';
        console.error('Error al cargar la información del servicio de garantía:', error);
      }
    });
  }

  cargarNumeroCompraInfo(idCompra: number) {
    if (!idCompra) {
      this.numeroCompraInfo = '';
      return;
    }
    this.comprasService.getCompraById(idCompra).subscribe({
      next: (compra) => {
        this.numeroCompraInfo = compra && compra.numeroCompra ? compra.numeroCompra : idCompra.toString();
      },
      error: (error) => {
        this.numeroCompraInfo = idCompra.toString();
        console.error('Error al cargar el número de compra:', error);
      }
    });
  }

  cargarNombreItemInfo(idItem: number) {
    if (!idItem) {
      this.nombreItemInfo = '';
      return;
    }
    this.lotesService.getLote(idItem).subscribe({
      next: (lote) => {
        this.nombreItemInfo = lote && lote.nombreItem ? lote.nombreItem : idItem.toString();
      },
      error: (error) => {
        this.nombreItemInfo = idItem.toString();
        console.error('Error al cargar el nombre del item:', error);
      }
    });
  }

  cargarDescripcionEntregaInfo(idEntrega: number) {
    if (!idEntrega) {
      this.descripcionEntregaInfo = '';
      return;
    }
    this.entregasService.getEntrega(idEntrega).subscribe({
      next: (entrega) => {
        this.descripcionEntregaInfo = entrega && entrega.descripcion ? entrega.descripcion : idEntrega.toString();
      },
      error: (error) => {
        this.descripcionEntregaInfo = idEntrega.toString();
        console.error('Error al cargar la descripción de la entrega:', error);
      }
    });
  }

  verDetallesEntrega(idEntrega: number, entregaModal: any) {
    this.entregasService.getEntrega(idEntrega).subscribe({
      next: (entrega) => {
        this.entregaSeleccionada = entrega;
        this.cargarNombreItemEntregaInfo(entrega.idItem, () => {
          this.modalService.open(entregaModal, { size: 'lg' });
        });
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles de la entrega';
      }
    });
  }

  cargarNombreItemEntregaInfo(idItem: number, callback?: () => void) {
    if (!idItem) {
      this.nombreItemEntregaInfo = '';
      if (callback) callback();
      return;
    }
    this.lotesService.getLote(idItem).subscribe({
      next: (lote) => {
        this.nombreItemEntregaInfo = lote && lote.nombreItem ? lote.nombreItem : idItem.toString();
        if (callback) callback();
      },
      error: (error) => {
        this.nombreItemEntregaInfo = idItem.toString();
        if (callback) callback();
        console.error('Error al cargar el nombre del item de la entrega:', error);
      }
    });
  }

  verDetallesUbicacion(idUbicacion: number | null, ubicacionModal: any) {
    if (!idUbicacion) {
      this.error = 'No hay ubicación asignada';
      return;
    }
    this.ubicacionesService.getUbicacionEquipo(idUbicacion).subscribe({
      next: (ubicacion: UbicacionDTO) => {
        this.ubicacionSeleccionada = ubicacion;
        this.modalService.open(ubicacionModal, { size: 'lg' });
      },
      error: (error: any) => {
        this.error = 'Error al cargar los detalles de la ubicación';
      }
    });
  }

  verDetallesUsuario(idUsuario: number, usuarioModal: any) {
    this.usuariosService.getUsuario(idUsuario).subscribe({
      next: (usuario) => {
        this.usuarioSeleccionado = usuario;
        this.modalService.open(usuarioModal, { size: 'lg' });
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles del usuario';
      }
    });
  }

  verDetallesTipoActivo(idTipoActivo: number, tipoActivoModal: any) {
    this.tiposActivoService.getTipoActivo(idTipoActivo).subscribe({
      next: (tipoActivo) => {
        this.tipoActivoSeleccionado = tipoActivo;
        this.cargarUsuarioResponsable(tipoActivo.idUsuario);
        this.modalService.open(tipoActivoModal, { size: 'lg' });
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles del tipo de activo';
      }
    });
  }

  verDetallesCompra(idCompra: number, compraModal: any) {
    this.comprasService.getCompraById(idCompra).subscribe({
      next: (compra) => {
        this.compraSeleccionada = compra;
        // Mostrar el numeroCompra
        this.numeroCompraInfo = compra && compra.numeroCompra ? compra.numeroCompra : idCompra.toString();
        // Cargar la descripción del tipo de compra desde TiposCompraService
        if (compra && compra.idTipoCompra) {
          this.tiposCompraService.getTipoCompra(compra.idTipoCompra).subscribe({
            next: (tipo) => {
              this.tipoCompraDescripcion = tipo && tipo.descripcion ? tipo.descripcion : compra.idTipoCompra.toString();
              this.modalService.open(compraModal, { size: 'lg' });
            },
            error: () => {
              this.tipoCompraDescripcion = compra.idTipoCompra.toString();
              this.modalService.open(compraModal, { size: 'lg' });
            }
          });
        } else {
          this.tipoCompraDescripcion = '';
          this.modalService.open(compraModal, { size: 'lg' });
        }
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles de la compra';
      }
    });
  }

  verDetallesLote(idLote: number, loteModal: any) {
    this.lotesService.getLote(idLote).subscribe({
      next: (lote) => {
        this.loteSeleccionado = lote;
        // Cargar información adicional
        this.cargarInformacionAdicionalLote(lote, loteModal);
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles del lote';
      }
    });
  }

  cargarInformacionAdicionalLote(lote: LoteDTO, loteModal: any) {
    // Cargar nombre del item
    this.nombreItemInfo = lote && lote.nombreItem ? lote.nombreItem : lote.idItem.toString();
    
    // Cargar número de compra
    if (lote && lote.idCompra) {
      this.comprasService.getCompraById(lote.idCompra).subscribe({
        next: (compra) => {
          this.numeroCompraLoteInfo = compra && compra.numeroCompra ? compra.numeroCompra : lote.idCompra.toString();
          
          // Cargar nombre comercial del servicio de garantía
          if (lote && lote.idServicioGarantia) {
            this.serviciosGarantiaService.getServicioGarantia(lote.idServicioGarantia).subscribe({
              next: (servicio) => {
                this.nombreComercialServicioInfo = servicio && servicio.nombreComercial ? servicio.nombreComercial : lote.idServicioGarantia.toString();
                this.modalService.open(loteModal, { size: 'lg' });
              },
              error: () => {
                this.nombreComercialServicioInfo = lote.idServicioGarantia.toString();
                this.modalService.open(loteModal, { size: 'lg' });
              }
            });
          } else {
            this.nombreComercialServicioInfo = '';
            this.modalService.open(loteModal, { size: 'lg' });
          }
        },
        error: () => {
          this.numeroCompraLoteInfo = lote.idCompra.toString();
          this.modalService.open(loteModal, { size: 'lg' });
        }
      });
    } else {
      this.numeroCompraLoteInfo = '';
      this.modalService.open(loteModal, { size: 'lg' });
    }
  }

  verDetallesServicioGarantia(idServicioGarantia: number, servicioGarantiaModal: any) {
    this.serviciosGarantiaService.getServicioGarantia(idServicioGarantia).subscribe({
      next: (servicio) => {
        this.servicioGarantiaSeleccionado = servicio;
        this.modalService.open(servicioGarantiaModal, { size: 'lg' });
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles del servicio de garantía';
      }
    });
  }

  verDetallesHardware(hardwareId: number) {
    this.router.navigate(['/menu/asset-details', hardwareId]);
  }

  verDetallesHardwarePorNombre(name: string): void {
    this.hardwareService.getHardware().subscribe({
      next: (hardwareList) => {
        const hardware = hardwareList.find((h: any) => h.name === name);
        if (hardware) {
          this.router.navigate(['/menu/asset-details', hardware.id]);
        } else {
          this.notificationService.showNotFoundError('No se encontró el hardware correspondiente.');
        }
      },
      error: () => {
        this.notificationService.showError(
          'Error al Buscar Hardware',
          'No se pudo buscar el hardware correspondiente.'
        );
      }
    });
  }

  volver() {
    this.location.back();
  }
} 