import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgbActiveModal, NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';
import { ActivosService, ActivoDTO } from '../../../services/activos.service';
import { EntregasService, EntregaDTO } from '../../../services/entregas.service';
import { UbicacionesService } from '../../../services/ubicaciones.service';
import { UbicacionDTO } from '../../../interfaces/ubicacion.interface';
import { UsuariosService, UsuarioDTO } from '../../../services/usuarios.service';
import { TiposActivoService, TipoDeActivoDTO } from '../../../services/tipos-activo.service';
import { ComprasService, CompraDTO } from '../../../services/compras.service';
import { LotesService, LoteDTO } from '../../../services/lotes.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../../services/servicios-garantia.service';
import { HardwareService } from '../../../services/hardware.service';
import { TiposCompraService } from '../../../services/tipos-compra.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-activo-view-modal',
  standalone: true,
  imports: [CommonModule, NgbModule],
  templateUrl: './activo-view-modal.component.html',
  styleUrls: ['./activo-view-modal.component.css']
})
export class ActivoViewModalComponent implements OnInit {
  @Input() idActivo!: number;

  activo: ActivoDTO | null = null;
  entregaSeleccionada: EntregaDTO | null = null;
  ubicacionSeleccionada: UbicacionDTO | null = null;
  usuarioSeleccionado: UsuarioDTO | null = null;
  tipoActivoSeleccionado: TipoDeActivoDTO | null = null;
  usuarioResponsable: UsuarioDTO | null = null;
  compraSeleccionada: CompraDTO | null = null;
  loteSeleccionado: LoteDTO | null = null;
  servicioGarantiaSeleccionado: ServicioGarantiaDTO | null = null;
  servicioGarantiaInfo = '';
  loading = false;
  error: string | null = null;
  ubicacionInfo = '';
  usuarioInfo = '';
  tipoActivoInfo = '';
  hardwareName = '';
  activosRelacionados: ActivoDTO[] = [];
  loadingRelacionados = false;
  errorRelacionados: string | null = null;
  private tipoActivoMap: Map<number, string> | null = null;
  numeroCompraInfo = '';
  tipoCompraDescripcion = '';
  nombreItemInfo = '';
  numeroCompraLoteInfo = '';
  nombreComercialServicioInfo = '';
  descripcionEntregaInfo = '';
  nombreItemEntregaInfo = '';

  constructor(
    public activeModal: NgbActiveModal,
    private router: Router,
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

  ngOnInit(): void {
    if (this.idActivo != null) {
      this.cargarActivo(this.idActivo);
    }
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }

  formatearFecha(fecha: string): string {
    if (!fecha) {
      return 'No disponible';
    }
    const date = new Date(fecha);
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const año = date.getFullYear();
    return `${dia}/${mes}/${año}`;
  }

  cargarActivo(id: number): void {
    this.loading = true;
    this.error = null;
    this.activosService.getActivo(id).subscribe({
      next: (activo) => {
        this.activo = activo;
        if (this.activo) {
          if (this.activo.idUbicacion != null) {
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
      error: () => {
        this.error = 'Error al cargar los detalles del activo';
        this.loading = false;
      }
    });
  }

  cargarActivosRelacionados(idActivo: number): void {
    this.loadingRelacionados = true;
    this.errorRelacionados = null;
    this.activosRelacionados = [];
    this.tipoActivoMap = new Map();

    this.activosService.getActivosRelacionados(idActivo).subscribe({
      next: (ids: number[]) => {
        if (ids?.length > 0) {
          forkJoin(ids.map((id) => this.activosService.getActivo(id))).subscribe({
            next: (activos) => {
              this.activosRelacionados = activos.filter((a) => a != null);
              this.activosRelacionados.forEach((activo) => {
                if (activo.idTipoActivo) {
                  this.cargarTipoActivoInfoRelacionado(activo.idTipoActivo, activo.idActivo);
                }
              });
              this.loadingRelacionados = false;
            },
            error: () => {
              this.errorRelacionados = 'No se pudieron cargar los detalles de los activos relacionados';
              this.activosRelacionados = [];
              this.loadingRelacionados = false;
            }
          });
        } else {
          this.loadingRelacionados = false;
        }
      },
      error: () => {
        this.errorRelacionados = 'No se pudieron cargar los activos relacionados';
        this.loadingRelacionados = false;
      }
    });
  }

  cargarTipoActivoInfoRelacionado(idTipoActivo: number, idActivo: number): void {
    this.tiposActivoService.getTipoActivo(idTipoActivo).subscribe({
      next: (tipoActivo) => {
        if (tipoActivo && this.tipoActivoMap) {
          this.tipoActivoMap.set(idActivo, tipoActivo.descripcion);
        }
      }
    });
  }

  getTipoActivoDescripcion(activo: ActivoDTO): string {
    return this.tipoActivoMap?.get(activo.idActivo) || 'Tipo de activo no disponible';
  }

  verDetallesActivoRelacionado(idActivoRelacionado: number): void {
    this.cargarActivo(idActivoRelacionado);
    this.idActivo = idActivoRelacionado;
  }

  cargarUbicacionInfo(idUbicacion: number): void {
    this.ubicacionesService.getUbicacionEquipo(idUbicacion).subscribe({
      next: (ubicacion: UbicacionDTO) => {
        this.ubicacionSeleccionada = ubicacion;
        this.ubicacionInfo = `${ubicacion.nombreGerencia} - ${ubicacion.nombreOficina}`;
      },
      error: () => {
        this.ubicacionInfo = 'No disponible';
      }
    });
  }

  cargarUsuarioInfo(idUsuario: number): void {
    this.usuariosService.getUsuario(idUsuario).subscribe({
      next: (usuario) => {
        this.usuarioSeleccionado = usuario;
        this.usuarioInfo = `${usuario.nombre} ${usuario.apellido}`;
      },
      error: () => {
        this.usuarioInfo = 'No disponible';
      }
    });
  }

  cargarTipoActivoInfo(idTipoActivo: number): void {
    this.tiposActivoService.getTipoActivo(idTipoActivo).subscribe({
      next: (tipoActivo) => {
        this.tipoActivoSeleccionado = tipoActivo;
        this.cargarUsuarioResponsable(tipoActivo.idUsuario);
        this.tipoActivoInfo = tipoActivo.descripcion;
      },
      error: () => {
        this.tipoActivoInfo = 'No disponible';
      }
    });
  }

  cargarUsuarioResponsable(idUsuario: number): void {
    this.usuariosService.getUsuario(idUsuario).subscribe({
      next: (usuario) => {
        this.usuarioResponsable = usuario;
      }
    });
  }

  cargarServicioGarantiaInfo(idServicioGarantia: number): void {
    this.serviciosGarantiaService.getServicioGarantia(idServicioGarantia).subscribe({
      next: (servicio) => {
        this.servicioGarantiaSeleccionado = servicio;
        this.servicioGarantiaInfo = servicio.nombreComercial;
      },
      error: () => {
        this.servicioGarantiaInfo = 'No disponible';
      }
    });
  }

  cargarNumeroCompraInfo(idCompra: number): void {
    if (!idCompra) {
      this.numeroCompraInfo = '';
      return;
    }
    this.comprasService.getCompraById(idCompra).subscribe({
      next: (compra) => {
        this.numeroCompraInfo =
          compra?.numeroCompra ? compra.numeroCompra : idCompra.toString();
      },
      error: () => {
        this.numeroCompraInfo = idCompra.toString();
      }
    });
  }

  cargarNombreItemInfo(idItem: number): void {
    if (!idItem) {
      this.nombreItemInfo = '';
      return;
    }
    this.lotesService.getLote(idItem).subscribe({
      next: (lote) => {
        this.nombreItemInfo = lote?.nombreItem ? lote.nombreItem : idItem.toString();
      },
      error: () => {
        this.nombreItemInfo = idItem.toString();
      }
    });
  }

  cargarDescripcionEntregaInfo(idEntrega: number): void {
    if (!idEntrega) {
      this.descripcionEntregaInfo = '';
      return;
    }
    this.entregasService.getEntrega(idEntrega).subscribe({
      next: (entrega) => {
        if (entrega?.fechaPedido) {
          this.descripcionEntregaInfo = this.formatearFecha(entrega.fechaPedido);
        } else {
          this.descripcionEntregaInfo =
            entrega?.descripcion?.trim() || idEntrega.toString();
        }
      },
      error: () => {
        this.descripcionEntregaInfo = idEntrega.toString();
      }
    });
  }

  verDetallesEntrega(idEntrega: number, entregaModal: unknown): void {
    this.entregasService.getEntrega(idEntrega).subscribe({
      next: (entrega) => {
        this.entregaSeleccionada = entrega;
        this.cargarNombreItemEntregaInfo(entrega.idItem, () => {
          this.modalService.open(entregaModal, {
            size: 'lg',
            windowClass: 'activo-details-modal',
            centered: true
          });
        });
      },
      error: () => {
        this.error = 'Error al cargar los detalles de la entrega';
      }
    });
  }

  cargarNombreItemEntregaInfo(idItem: number, callback?: () => void): void {
    if (!idItem) {
      this.nombreItemEntregaInfo = '';
      callback?.();
      return;
    }
    this.lotesService.getLote(idItem).subscribe({
      next: (lote) => {
        this.nombreItemEntregaInfo = lote?.nombreItem ? lote.nombreItem : idItem.toString();
        callback?.();
      },
      error: () => {
        this.nombreItemEntregaInfo = idItem.toString();
        callback?.();
      }
    });
  }

  verDetallesUbicacion(idUbicacion: number | null, ubicacionModal: unknown): void {
    if (!idUbicacion) {
      this.error = 'No hay ubicación asignada';
      return;
    }
    this.ubicacionesService.getUbicacionEquipo(idUbicacion).subscribe({
      next: (ubicacion: UbicacionDTO) => {
        this.ubicacionSeleccionada = ubicacion;
        this.modalService.open(ubicacionModal, {
          size: 'lg',
          windowClass: 'activo-details-modal',
          centered: true
        });
      },
      error: () => {
        this.error = 'Error al cargar los detalles de la ubicación';
      }
    });
  }

  verDetallesUsuario(idUsuario: number, usuarioModal: unknown): void {
    this.usuariosService.getUsuario(idUsuario).subscribe({
      next: (usuario) => {
        this.usuarioSeleccionado = usuario;
        this.modalService.open(usuarioModal, {
          size: 'lg',
          windowClass: 'activo-details-modal',
          centered: true
        });
      },
      error: () => {
        this.error = 'Error al cargar los detalles del usuario';
      }
    });
  }

  verDetallesTipoActivo(idTipoActivo: number, tipoActivoModal: unknown): void {
    this.tiposActivoService.getTipoActivo(idTipoActivo).subscribe({
      next: (tipoActivo) => {
        this.tipoActivoSeleccionado = tipoActivo;
        this.cargarUsuarioResponsable(tipoActivo.idUsuario);
        this.modalService.open(tipoActivoModal, {
          size: 'lg',
          windowClass: 'activo-details-modal',
          centered: true
        });
      },
      error: () => {
        this.error = 'Error al cargar los detalles del tipo de activo';
      }
    });
  }

  verDetallesCompra(idCompra: number, compraModal: unknown): void {
    this.comprasService.getCompraById(idCompra).subscribe({
      next: (compra) => {
        this.compraSeleccionada = compra;
        this.numeroCompraInfo =
          compra?.numeroCompra ? compra.numeroCompra : idCompra.toString();
        if (compra?.idTipoCompra) {
          this.tiposCompraService.getTipoCompra(compra.idTipoCompra).subscribe({
            next: (tipo) => {
              this.tipoCompraDescripcion =
                tipo?.descripcion ? tipo.descripcion : compra.idTipoCompra.toString();
              this.modalService.open(compraModal, {
                size: 'lg',
                windowClass: 'activo-details-modal',
                centered: true
              });
            },
            error: () => {
              this.tipoCompraDescripcion = compra.idTipoCompra.toString();
              this.modalService.open(compraModal, {
                size: 'lg',
                windowClass: 'activo-details-modal',
                centered: true
              });
            }
          });
        } else {
          this.tipoCompraDescripcion = '';
          this.modalService.open(compraModal, {
            size: 'lg',
            windowClass: 'activo-details-modal',
            centered: true
          });
        }
      },
      error: () => {
        this.error = 'Error al cargar los detalles de la compra';
      }
    });
  }

  verDetallesLote(idLote: number, loteModal: unknown): void {
    this.lotesService.getLote(idLote).subscribe({
      next: (lote) => {
        this.loteSeleccionado = lote;
        this.cargarInformacionAdicionalLote(lote, loteModal);
      },
      error: () => {
        this.error = 'Error al cargar los detalles del lote';
      }
    });
  }

  cargarInformacionAdicionalLote(lote: LoteDTO, loteModal: unknown): void {
    this.nombreItemInfo = lote?.nombreItem ? lote.nombreItem : lote.idItem.toString();

    if (lote?.idCompra) {
      this.comprasService.getCompraById(lote.idCompra).subscribe({
        next: (compra) => {
          this.numeroCompraLoteInfo =
            compra?.numeroCompra ? compra.numeroCompra : lote.idCompra.toString();

          if (lote.idServicioGarantia) {
            this.serviciosGarantiaService.getServicioGarantia(lote.idServicioGarantia).subscribe({
              next: (servicio) => {
                this.nombreComercialServicioInfo =
                  servicio?.nombreComercial
                    ? servicio.nombreComercial
                    : lote.idServicioGarantia.toString();
                this.modalService.open(loteModal, {
                  size: 'lg',
                  windowClass: 'activo-details-modal',
                  centered: true
                });
              },
              error: () => {
                this.nombreComercialServicioInfo = lote.idServicioGarantia.toString();
                this.modalService.open(loteModal, {
                  size: 'lg',
                  windowClass: 'activo-details-modal',
                  centered: true
                });
              }
            });
          } else {
            this.nombreComercialServicioInfo = '';
            this.modalService.open(loteModal, {
              size: 'lg',
              windowClass: 'activo-details-modal',
              centered: true
            });
          }
        },
        error: () => {
          this.numeroCompraLoteInfo = lote.idCompra.toString();
          this.modalService.open(loteModal, {
            size: 'lg',
            windowClass: 'activo-details-modal',
            centered: true
          });
        }
      });
    } else {
      this.numeroCompraLoteInfo = '';
      this.modalService.open(loteModal, {
        size: 'lg',
        windowClass: 'activo-details-modal',
        centered: true
      });
    }
  }

  verDetallesServicioGarantia(idServicioGarantia: number, servicioGarantiaModal: unknown): void {
    this.serviciosGarantiaService.getServicioGarantia(idServicioGarantia).subscribe({
      next: (servicio) => {
        this.servicioGarantiaSeleccionado = servicio;
        this.modalService.open(servicioGarantiaModal, {
          size: 'lg',
          windowClass: 'activo-details-modal',
          centered: true
        });
      },
      error: () => {
        this.error = 'Error al cargar los detalles del servicio de garantía';
      }
    });
  }

  verDetallesHardwarePorNombre(name: string): void {
    this.hardwareService.getHardware().subscribe({
      next: (hardwareList) => {
        const hardware = hardwareList.find((h: { name?: string }) => h.name === name);
        if (hardware) {
          this.activeModal.dismiss();
          void this.router.navigate(['/menu/asset-details', hardware.id]);
        } else {
          this.notificationService.showNotFoundError(
            'No se encontró el hardware correspondiente.'
          );
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
}
