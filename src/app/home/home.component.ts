import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgxParticlesModule, NgParticlesService } from '@tsparticles/angular';
import { loadSlim } from '@tsparticles/slim';
import { MoveDirection, IOptions, RecursivePartial } from '@tsparticles/engine';
import { FormsModule } from '@angular/forms'; // Importa FormsModule para usar ngModel

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgxParticlesModule, FormsModule], // Asegúrate de agregar FormsModule aquí
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  username: string = '';
  password: string = '';

  constructor(private router: Router, private readonly ngParticlesService: NgParticlesService) {}

  particlesOptions: RecursivePartial<IOptions> = {
    particles: {
      number: {
        value: 50,
      },
      size: {
        value: 3,
      },
      move: {
        enable: true,
        direction: MoveDirection.none,
        speed: 1,
        random: true,
        straight: false,
      },
      links: {
        enable: true,
        distance: 150,
        color: "#ffffff",
        opacity: 0.4,
        width: 1,
      },
    },
  };

  ngOnInit(): void {
    this.ngParticlesService.init(async (engine) => {
      await loadSlim(engine);
      console.log("tsParticles engine loaded successfully");
    });
  }

  onSubmit(): void {
    console.log("Usuario:", this.username);
    console.log("Contraseña:", this.password);
    this.router.navigate(['/menu']);  // Redirige al menú
  }
}
