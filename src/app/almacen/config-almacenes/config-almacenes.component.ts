import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenConfig } from '../../interfaces/almacen-config.interface';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';

@Component({
  selector: 'app-config-almacenes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbModule, NotificationContainerComponent],
  templateUrl: './config-almacenes.component.html',
  styleUrls: ['./config-almacenes.component.css']
})
export class ConfigAlmacenesComponent implements OnInit {
  almacenes: Almacen[] = [];
  configs: AlmacenConfig[] = [];
  almacenConfigForm: FormGroup;
  modoEdicionConfig: boolean = false;
  configSeleccionada: AlmacenConfig | null = null;
  loadingConfigs: boolean = false;

  constructor(
    private almacenService: AlmacenService,
    private almacenConfigService: AlmacenConfigService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.almacenConfigForm = this.fb.group({
      almacenId: ['', Validators.required],
      nombre: [''],
      cantidadEstanterias: [1, [Validators.required, Validators.min(1)]],
      cantidadEstantesPorEstanteria: [1, [Validators.required, Validators.min(1)]],
      divisionesEstante: ['A,B,C', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.cargarAlmacenesYConfigs();
  }

  cargarAlmacenesYConfigs(): void {
    this.loadingConfigs = true;
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes) => {
        this.almacenes = almacenes;
        this.cargarConfigs();
      },
      error: (error) => {
        console.error('Error al cargar almacenes:', error);
        this.loadingConfigs = false;
        this.notificationService.showError('Error', 'No se pudieron cargar los almacenes');
      }
    });
  }

  cargarConfigs(): void {
    this.almacenConfigService.getAllConfigs().subscribe({
      next: (configs) => {
        this.configs = configs;
        this.loadingConfigs = false;
      },
      error: (error) => {
        console.error('Error al cargar configuraciones:', error);
        this.loadingConfigs = false;
        this.notificationService.showError('Error', 'No se pudieron cargar las configuraciones');
      }
    });
  }

  abrirModalConfig(modal: any, config?: AlmacenConfig): void {
    this.modoEdicionConfig = !!config;
    this.configSeleccionada = config || null;

    if (this.modoEdicionConfig && config) {
      this.almacenConfigForm.patchValue({
        almacenId: config.almacen.id,
        nombre: config.nombre || '',
        cantidadEstanterias: config.cantidadEstanterias,
        cantidadEstantesPorEstanteria: config.cantidadEstantesPorEstanteria,
        divisionesEstante: config.divisionesEstante
      });
    } else {
      this.almacenConfigForm.reset({
        almacenId: '',
        nombre: '',
        cantidadEstanterias: 1,
        cantidadEstantesPorEstanteria: 1,
        divisionesEstante: 'A,B,C'
      });
    }

    this.modalService.open(modal, { size: 'lg', backdrop: true });
  }

  guardarConfig(): void {
    if (this.almacenConfigForm.valid) {
      const formData = this.almacenConfigForm.value;
      const configData = {
        almacenId: parseInt(formData.almacenId),
        nombre: formData.nombre || undefined,
        cantidadEstanterias: parseInt(formData.cantidadEstanterias),
        cantidadEstantesPorEstanteria: parseInt(formData.cantidadEstantesPorEstanteria),
        divisionesEstante: formData.divisionesEstante.trim()
      };

      if (this.modoEdicionConfig && this.configSeleccionada) {
        this.almacenConfigService.updateConfig(this.configSeleccionada.id, configData).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarConfigs();
          },
          error: (error) => {
            console.error('Error al actualizar configuración:', error);
            this.notificationService.showError('Error', 'No se pudo actualizar la configuración');
          }
        });
      } else {
        this.almacenConfigService.createConfig(configData).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarConfigs();
          },
          error: (error) => {
            console.error('Error al crear configuración:', error);
            this.notificationService.showError('Error', 'No se pudo crear la configuración');
          }
        });
      }
    }
  }

  eliminarConfig(config: AlmacenConfig): void {
    if (confirm(`¿Está seguro de que desea eliminar la configuración del almacén "${config.almacen.nombre}"?`)) {
      this.almacenConfigService.deleteConfig(config.id).subscribe({
        next: () => {
          this.cargarConfigs();
        },
        error: (error) => {
          console.error('Error al eliminar configuración:', error);
          this.notificationService.showError('Error', 'No se pudo eliminar la configuración');
        }
      });
    }
  }

  getConfigForAlmacen(almacenId: number): AlmacenConfig | undefined {
    return this.configs.find(c => c.almacen.id === almacenId);
  }

  getDivisionesArray(divisionesEstante: string): string[] {
    return this.almacenConfigService.getDivisionesArray(divisionesEstante);
  }
}

