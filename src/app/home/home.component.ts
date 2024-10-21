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
        value: 100,
        density: {
          enable: true,
        }
      },
      color: {
        value: ["#ffffff"],
      },
      shape: {
        type: ["circle", "polygon"],
        options: {
          polygon: {
            sides: 6
          }
        }
      },
      opacity: {
        value: { min: 0.1, max: 0.5 },
        animation: {
          enable: true,
          speed: 1,
          startValue: "min",
          sync: false
        }
      },
      size: {
        value: { min: 1, max: 3 },
        animation: {
          enable: true,
          speed: 2,
          startValue: "min",
          sync: false
        }
      },
      links: {
        enable: true,
        distance: 150,
        color: "#ffffff",
        opacity: 0.5,
        width: 1
      },
      move: {
        enable: true,
        speed: 3.0, // Aumenta la velocidad a 3.0 para un movimiento más rápido
        direction: "none",
        random: true,
        straight: false,
        outModes: {
          default: "out"
        },
        attract: {
          enable: false,
          rotate: { x: 600, y: 1200 }
        }
      }
    },
    interactivity: {
      detectsOn: "window", 
      events: {
        onHover: {
          enable: true,
          mode: "repulse",
        },
        onClick: {
          enable: true,
          mode: "push"
        },
        resize: {
          enable: true,
          delay: 0.5
        }
      },
      modes: {
        repulse: {
          distance: 200,
          duration: 0.4
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
