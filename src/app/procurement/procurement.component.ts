import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './procurement.component.html',
  styleUrls: ['./procurement.component.css']
})
export class ProcurementComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    // Redirigir a la página de activos por defecto
    this.router.navigate(['/menu/procurement/activos']);
  }
}
