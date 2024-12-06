import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubnetService, SubnetDTO } from '../services/subnet.service';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { forkJoin } from 'rxjs';

// Extendemos la interfaz SubnetDTO para incluir las propiedades adicionales
interface ExtendedSubnet extends SubnetDTO {
  latitud?: number;
  longitud?: number;
  hasCoordinates: boolean;
  editing: boolean;
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

  private montevideoCenter = {
    lat: -34.9011,
    lng: -56.1645
  };

  constructor(private subnetService: SubnetService) {}

  ngOnInit(): void {
    this.loadSubnets();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  private loadSubnets(): void {
    forkJoin({
      subnets: this.subnetService.getSubnets(),
      coordinates: this.subnetService.getAllSubnetCoordinates()
    }).subscribe({
      next: ({ subnets, coordinates }) => {
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
    this.subnetService.getSubnetCoordinates(subnet.netId).subscribe(coords => {
      subnet.latitud = coords.latitud;
      subnet.longitud = coords.longitud;
    });
  }

  private initMap(): void {
    // Configuración de iconos base
    const iconRetinaUrl = 'assets/images/marker-icon-2x.png';
    const iconUrl = 'assets/images/marker-icon.png';
    const shadowUrl = 'assets/images/marker-shadow.png';
    
    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });

    // Crear el mapa
    this.map = L.map('map', {
      center: [ -34.6037, -58.3816 ],
      zoom: 12
    });

    // Intentar cargar el mapa con manejo de errores
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Manejar errores de carga de tiles
    tileLayer.on('tileerror', (error) => {
      console.warn('Error loading tile:', error);
      // Aquí podrías mostrar un mensaje al usuario o cargar un tile por defecto
    });

    this.markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 80,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let size = 40;
        let className = 'marker-cluster-';
        
        if (count < 10) {
          className += 'small';
        } else if (count < 100) {
          className += 'medium';
          size = 50;
        } else {
          className += 'large';
          size = 60;
        }
        
        return L.divIcon({
          html: '<div><span>' + count + '</span></div>',
          className: 'marker-cluster ' + className,
          iconSize: new L.Point(size, size)
        });
      }
    });

    this.map.addLayer(this.markerClusterGroup);
  }

  private addMarkersToMap(): void {
    // Limpiar marcadores y líneas existentes
    this.markerClusterGroup?.clearLayers();
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
} 