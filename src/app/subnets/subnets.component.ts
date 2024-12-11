import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubnetService, SubnetDTO, SubnetCoordinatesDTO } from '../services/subnet.service';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { forkJoin } from 'rxjs';

// Extendemos la interfaz SubnetDTO para incluir las propiedades adicionales
interface ExtendedSubnet extends SubnetDTO {
  latitud?: number;
  longitud?: number;
  hasCoordinates: boolean;
  editing: boolean;
  [key: string]: any;
}

// Añade esta declaración después de las importaciones
declare module 'leaflet' {
  interface Map {
    markerClusterGroup: () => L.MarkerClusterGroup;
  }
}

@Component({
  selector: 'app-subnets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subnets.component.html',
  styleUrls: ['./subnets.component.css']
})
export class SubnetsComponent implements OnInit, AfterViewInit {
  subnets: ExtendedSubnet[] = [];
  private map: L.Map | undefined;
  private markerClusterGroup: L.MarkerClusterGroup | undefined;
  private lines: L.Polyline[] = [];
  public sortColumn: string = '';
  public sortDirection: 'asc' | 'desc' = 'asc';

  private montevideoCenter = {
    lat: -34.9011,
    lng: -56.1645
  };

  constructor(private subnetService: SubnetService) {}

  ngOnInit(): void {
    console.log('Iniciando componente SubnetsComponent');
    this.loadResources()
      .then(() => {
        console.log('Recursos cargados, iniciando mapa...');
        return this.initMap();
      })
      .then(() => {
        console.log('Mapa iniciado, cargando subredes...');
        this.loadSubnets();
      })
      .catch(error => {
        console.error('Error en la inicialización:', error);
      });
  }

  ngAfterViewInit(): void {
    // Ya no necesitamos inicializar aquí
  }

  private loadSubnets(): void {
    console.log('Cargando subredes...');
    this.subnetService.getSubnets().subscribe({
      next: (subnets) => {
        console.log('Subredes recibidas:', subnets);
        forkJoin({
          subnets: this.subnetService.getSubnets(),
          coordinates: this.subnetService.getAllSubnetCoordinates()
        }).subscribe({
          next: ({ subnets, coordinates }: { subnets: SubnetDTO[], coordinates: SubnetCoordinatesDTO[] }) => {
            const coordMap = new Map(coordinates.map(c => [c.netId, c]));
            
            this.subnets = subnets.map(subnet => {
              const coords = coordMap.get(subnet.netId);
              return {
                ...subnet,
                latitud: coords?.latitud,
                longitud: coords?.longitud,
                hasCoordinates: !!coords,
                editing: false
              };
            });
            
            this.addMarkersToMap();
          },
          error: (error) => {
            console.error('Error al cargar datos:', error);
          }
        });
      },
      error: (error) => console.error('Error cargando subredes:', error)
    });
  }

  isValidCoordinates(subnet: ExtendedSubnet): boolean {
    return typeof subnet.latitud === 'number' && 
           typeof subnet.longitud === 'number' &&
           subnet.latitud >= -90 && subnet.latitud <= 90 &&
           subnet.longitud >= -180 && subnet.longitud <= 180;
  }

  saveCoordinates(subnet: ExtendedSubnet): void {
    if (!this.isValidCoordinates(subnet)) return;
    
    this.subnetService.saveSubnetCoordinates(subnet.netId, subnet.latitud!, subnet.longitud!)
      .subscribe({
        next: () => {
          subnet.hasCoordinates = true;
          this.addMarkersToMap();
        },
        error: (error) => {
          console.error('Error al guardar coordenadas:', error);
        }
      });
  }

  editCoordinates(subnet: ExtendedSubnet): void {
    subnet.editing = true;
  }

  updateCoordinates(subnet: ExtendedSubnet): void {
    if (!this.isValidCoordinates(subnet)) return;
    
    this.subnetService.updateSubnetCoordinates(subnet.netId, subnet.latitud!, subnet.longitud!)
      .subscribe({
        next: () => {
          subnet.editing = false;
          this.addMarkersToMap();
        },
        error: (error) => {
          console.error('Error al actualizar coordenadas:', error);
        }
      });
  }

  cancelEdit(subnet: ExtendedSubnet): void {
    subnet.editing = false;
    // Recargar las coordenadas originales
    this.subnetService.getSubnetCoordinates(subnet.netId).subscribe((coords: SubnetCoordinatesDTO) => {
      subnet.latitud = coords.latitud;
      subnet.longitud = coords.longitud;
    });
  }

  private async loadResources(): Promise<void> {
    return new Promise((resolve) => {
      console.log('Iniciando carga de recursos locales...');

      // Verificar si Leaflet ya está cargado
      if (typeof L === 'undefined') {
        console.error('Leaflet no está cargado. Verifica que el script esté incluido correctamente.');
        return;
      }

      // Configurar la ruta de los iconos
      L.Icon.Default.imagePath = './assets/leaflet/images/';
      console.log('Ruta de iconos configurada:', L.Icon.Default.imagePath);

      // Verificar si MarkerCluster ya está disponible
      if (typeof L.markerClusterGroup === 'function') {
        console.log('MarkerCluster ya está disponible');
        resolve();
        return;
      }

      // Si no está disponible, intentar cargarlo
      const script = document.createElement('script');
      script.src = './assets/leaflet.markercluster/leaflet.markercluster.js';
      
      script.onload = () => {
        console.log('MarkerCluster cargado, verificando estado:', {
          leaflet: typeof L,
          markerCluster: typeof L?.markerClusterGroup,
          hasFunction: typeof L?.markerClusterGroup === 'function'
        });
        
        if (typeof L?.markerClusterGroup === 'function') {
          console.log('MarkerCluster inicializado correctamente');
          resolve();
        } else {
          console.error('Error: MarkerCluster no disponible después de cargar');
          // Intentar obtener desde window
          if (typeof window['L']?.markerClusterGroup === 'function') {
            Object.defineProperty(L, 'markerClusterGroup', {
              value: window['L'].markerClusterGroup.bind(window['L']),
              configurable: true
            });
            console.log('MarkerCluster copiado desde window.L');
            resolve();
          }
        }
      };

      script.onerror = (error) => {
        console.error('Error cargando MarkerCluster:', error);
      };

      document.body.appendChild(script);
    });
  }

  private async initMap(): Promise<void> {
    if (!this.map) {
      console.log('Creando mapa...');
      this.map = L.map('map', {
        center: [this.montevideoCenter.lat, this.montevideoCenter.lng],
        zoom: 13
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      this.markerClusterGroup = L.markerClusterGroup();
      this.map.addLayer(this.markerClusterGroup);
      console.log('Mapa creado correctamente');
    }
  }

  private addMarkersToMap(): void {
    if (!this.map || !this.markerClusterGroup) {
      console.error('Mapa o markerClusterGroup no inicializados');
      return;
    }

    // Limpiar marcadores y líneas existentes
    this.markerClusterGroup.clearLayers();
    this.lines.forEach(line => line.remove());
    this.lines = [];

    // Agregar marcadores solo para subredes con coordenadas
    const subnetsWithCoordinates = this.subnets.filter(subnet => 
      subnet.hasCoordinates && subnet.latitud && subnet.longitud
    );

    subnetsWithCoordinates.forEach(subnet => {
      const marker = L.marker([subnet.latitud!, subnet.longitud!])
        .bindPopup(`
          <b>${subnet.name}</b><br>
          Net ID: ${subnet.netId}
        `);
      this.markerClusterGroup?.addLayer(marker);
    });

    // Dibujar líneas entre subredes conectadas si lo deseas
    // (opcional, podrías querer remover las líneas si usas clusters)
    for (let i = 0; i < subnetsWithCoordinates.length - 1; i++) {
      const line = L.polyline([
        [subnetsWithCoordinates[i].latitud!, subnetsWithCoordinates[i].longitud!],
        [subnetsWithCoordinates[i + 1].latitud!, subnetsWithCoordinates[i + 1].longitud!]
      ], {
        color: '#85c1e9',
        weight: 2,
        opacity: 0.7
      }).addTo(this.map!);
      this.lines.push(line);
    }
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.subnets.sort((a, b) => {
      let valueA = a[column];
      let valueB = b[column];

      // Manejo especial para IPs
      if (column === 'ipAddr' || column === 'mask') {
        valueA = valueA.split('.').map((num: string) => parseInt(num, 10));
        valueB = valueB.split('.').map((num: string) => parseInt(num, 10));
        
        for (let i = 0; i < 4; i++) {
          if (valueA[i] !== valueB[i]) {
            return (valueA[i] - valueB[i]) * (this.sortDirection === 'asc' ? 1 : -1);
          }
        }
        return 0;
      }

      // Manejo normal para otros campos
      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
} 