import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivosService, ActivoDTO } from '../../../services/activos.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { EntregasService, EntregaDTO } from '../../../services/entregas.service';
import { UbicacionesService, Ubicacion } from '../../../services/ubicaciones.service';
import { UsuariosService, UsuarioDTO } from '../../../services/usuarios.service';
import { TiposActivoService, TipoDeActivoDTO } from '../../../services/tipos-activo.service';
import { ComprasService, CompraDTO } from '../../../services/compras.service';
import { LotesService, LoteDTO } from '../../../services/lotes.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../../services/servicios-garantia.service';
import { HardwareService } from '../../../services/hardware.service';

@Component({
  selector: 'app-activo-details',
  standalone: true,
  imports: [CommonModule, NgbModule],
  templateUrl: './activo-details.component.html',
  styleUrls: ['./activo-details.component.css']
})
export class ActivoDetailsComponent implements OnInit {
  activo: ActivoDTO | null = null;
  entregaSeleccionada: EntregaDTO | null = null;
  ubicacionSeleccionada: Ubicacion | null = null;
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private activosService: ActivosService,
    private entregasService: EntregasService,
    private ubicacionesService: UbicacionesService,
    private usuariosService: UsuariosService,
    private tiposActivoService: TiposActivoService,
    private comprasService: ComprasService,
    private lotesService: LotesService,
    private serviciosGarantiaService: ServiciosGarantiaService,
    private hardwareService: HardwareService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarActivo(parseInt(id));
    }
  }

  cargarActivo(id: number) {
    this.loading = true;
    this.error = null;
    this.activosService.getActivo(id).subscribe({
      next: (activo) => {
        this.activo = activo;
        this.cargarUbicacionInfo(activo.idUbicacion);
        this.cargarUsuarioInfo(activo.idUsuario);
        this.cargarTipoActivoInfo(activo.idTipoActivo);
        this.cargarServicioGarantiaInfo(activo.idServicioGarantia);
        this.cargarHardwareInfo(activo.hardwareId);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles del activo';
        this.loading = false;
      }
    });
  }

  cargarHardwareInfo(hardwareId: number) {
    this.hardwareService.getHardwareById(hardwareId).subscribe({
      next: (hardware) => {
        this.hardwareName = hardware.name || `PC-${hardwareId}`;
      },
      error: (error) => {
        this.hardwareName = `PC-${hardwareId}`;
        console.error('Error al cargar la información del hardware:', error);
      }
    });
  }

  cargarUbicacionInfo(idUbicacion: number) {
    this.ubicacionesService.getUbicacionByHardwareId(idUbicacion).subscribe({
      next: (ubicacion) => {
        this.ubicacionSeleccionada = ubicacion;
        this.ubicacionInfo = `${ubicacion.nombreGerencia} - ${ubicacion.nombreOficina}`;
      },
      error: (error) => {
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

  verDetallesEntrega(idEntrega: number, entregaModal: any) {
    this.entregasService.getEntrega(idEntrega).subscribe({
      next: (entrega) => {
        this.entregaSeleccionada = entrega;
        this.modalService.open(entregaModal, { size: 'lg' });
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles de la entrega';
      }
    });
  }

  verDetallesUbicacion(idUbicacion: number, ubicacionModal: any) {
    this.ubicacionesService.getUbicacionByHardwareId(idUbicacion).subscribe({
      next: (ubicacion) => {
        this.ubicacionSeleccionada = ubicacion;
        this.modalService.open(ubicacionModal, { size: 'lg' });
      },
      error: (error) => {
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
        this.modalService.open(compraModal, { size: 'lg' });
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
        this.modalService.open(loteModal, { size: 'lg' });
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles del lote';
      }
    });
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

  volver() {
    this.router.navigate(['/menu/procurement/activos']);
  }
} 