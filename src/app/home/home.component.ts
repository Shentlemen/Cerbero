import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgxParticlesModule, NgParticlesService } from '@tsparticles/angular';
import { loadSlim } from '@tsparticles/slim';
import { IOptions, RecursivePartial } from '@tsparticles/engine';
import { FormsModule } from '@angular/forms';
import { loadPolygonShape } from '@tsparticles/shape-polygon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgxParticlesModule, FormsModule],
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
        density: {
          enable: true,
        },
      },
      color: {
        value: ["#4ca1af", "#2c3e50"],
      },
      size: {
        value: { min: 2, max: 5 },
        animation: {
          enable: true,
          speed: 5,
          startValue: "min",
          sync: false,
        },
      },
      move: {
        enable: true,
        direction: "none",
        speed: 6,
        outModes: {
          default: "bounce",
        },
        random: false,
        straight: false,
      },
      links: {
        enable: true,
        distance: 150,
        color: "#ffffff",
        opacity: 0.4,
        width: 1,
      },
      opacity: {
        value: 0.5,
        animation: {
          enable: true,
          speed: 1,
          startValue: "min",
          sync: false,
        },
      },
      shape: {
        type: "polygon",
        options: {
          sides: {
            value: 4,
          },
        },
      },
    },
    interactivity: {
      events: {
        onClick: {
          enable: true,
          mode: "push",  // Modo "push" para crear más partículas
        },
      },
      modes: {
        push: {
          quantity: 4,  // Cantidad de partículas que se crearán al hacer clic
        },
      },
    },    
  };

  ngOnInit(): void {
    this.ngParticlesService.init(async (engine) => {
      await loadSlim(engine);
      await loadPolygonShape(engine);
      console.log("tsParticles engine loaded successfully");
    });
  }

  onSubmit(): void {
    console.log("Usuario:", this.username);
    console.log("Contraseña:", this.password);
    this.router.navigate(['/menu']);  // Redirige al menú
  }
}
