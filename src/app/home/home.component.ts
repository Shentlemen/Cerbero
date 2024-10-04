import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgxParticlesModule, NgParticlesService } from '@tsparticles/angular';
import { loadSlim } from '@tsparticles/slim';
import { IOptions, RecursivePartial } from '@tsparticles/engine';
import { FormsModule } from '@angular/forms';
import { loadPolygonShape } from '@tsparticles/shape-polygon';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgxParticlesModule, FormsModule, NgIf],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  username: string = '';
  password: string = '';
  loginError: boolean = false;

  constructor(private router: Router, private readonly ngParticlesService: NgParticlesService) {}

  particlesOptions: RecursivePartial<IOptions> = {
    fpsLimit: 120,
    particles: {
      number: {
        value: 80,
        density: {
          enable: true,
        }
      },
      color: {
        value: ["#4ca1af", "#2c3e50", "#16a085", "#8e44ad", "#2980b9"],
      },
      shape: {
        type: ["circle", "triangle", "polygon"],
        options: {
          polygon: {
            sides: 6
          }
        }
      },
      opacity: {
        value: 0.5,
        animation: {
          enable: true,
          speed: 1,
          startValue: "min",
          sync: false
        }
      },
      size: {
        value: { min: 1, max: 5 },
        animation: {
          enable: true,
          speed: 4,
          startValue: "min",
          sync: false
        }
      },
      links: {
        enable: true,
        distance: 150,
        color: "#ffffff",
        opacity: 0.4,
        width: 1
      },
      move: {
        enable: true,
        speed: 2,
        direction: "none",
        random: false,
        straight: false,
        outModes: {
          default: "out"
        },
        attract: {
          enable: true,
          rotate: { x: 600, y: 1200 }
        }
      }
    },
    interactivity: {
      detectsOn: "window", // Detectar eventos en toda la ventana
      events: {
        onHover: {
          enable: true,
          mode: "repulse",
        },
        onClick: {
          enable: true,
          mode: "push"
        },
        onDiv: [{ // Interacción con elementos específicos
          selectors: ['#logo', '#loginBox'], // IDs de los elementos
          enable: true,
          mode: "repulse",
          type: "rectangle"
        }],
        resize: { // Cambiado para que resize sea un objeto
          enable: true, // Ahora se usa un objeto con la propiedad enable
          delay: 0.5
        }
      },
      modes: {
        grab: {
          distance: 400,
          links: {
            opacity: 1
          }
        },
        bubble: {
          distance: 400,
          size: 40,
          duration: 2,
          opacity: 8,
          speed: 3
        },
        repulse: {
          distance: 200,
          duration: 0.4
        },
        push: {
          quantity: 4
        },
        remove: {
          quantity: 2
        }
      }
    },
    detectRetina: true
  };

  ngOnInit(): void {
    this.ngParticlesService.init(async (engine) => {
      await loadSlim(engine);
      await loadPolygonShape(engine);
      console.log("tsParticles engine loaded successfully");
    });
  }

  onSubmit(): void {
    if (this.username === 'admin' && this.password === 'admin') {
      this.loginError = false;
      this.router.navigate(['/menu/dashboard']);
    } else {
      this.loginError = true;
    }
  }
}
