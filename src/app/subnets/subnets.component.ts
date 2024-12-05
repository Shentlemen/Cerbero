import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubnetService, SubnetDTO } from '../services/subnet.service';

@Component({
  selector: 'app-subnets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subnets.component.html',
  styleUrls: ['./subnets.component.css']
})
export class SubnetsComponent implements OnInit {
  subnets: SubnetDTO[] = [];

  constructor(private subnetService: SubnetService) {}

  ngOnInit(): void {
    this.subnetService.getSubnets().subscribe({
      next: (data) => {
        this.subnets = data;
      },
      error: (error) => {
        console.error('Error al cargar las subredes:', error);
      }
    });
  }
} 