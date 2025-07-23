import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgxParticlesModule, NgParticlesService } from '@tsparticles/angular';
import { loadSlim } from '@tsparticles/slim';
import { IOptions, RecursivePartial } from '@tsparticles/engine';
import { FormsModule } from '@angular/forms';
import { loadPolygonShape } from '@tsparticles/shape-polygon';
import { NgIf } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { LoginRequest } from '../interfaces/auth.interface';

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
  loading: boolean = false;
  errorMessage: string = '';

  constructor(
    private router: Router, 
    private readonly ngParticlesService: NgParticlesService,
    private authService: AuthService
  ) {}

  particlesOptions: RecursivePartial<IOptions> = {
    fpsLimit: 120,
    particles: {
      number: {
        value: 60,
        density: {
          enable: true,
        }
      },
      color: {
        value: ["#ffffff"],
      },
      shape: {
        type: "circle",
      },
      opacity: {
        value: 0.7,
      },
      size: {
        value: { min: 1, max: 4 },
        animation: {
          enable: true,
          speed: 2,
          startValue: "min",
          sync: false
        }
      },
      wobble: {
        enable: true,
        distance: 10,
        speed: 2
      },
      move: {
        enable: true,
        speed: 2,
        direction: "bottom",
        straight: false,
        random: true,
        outModes: {
          default: "out",
          bottom: "out",
          top: "out"
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
    if (this.username && this.password) {
      this.loading = true;
      this.loginError = false;
      this.errorMessage = '';

      const loginRequest: LoginRequest = {
        username: this.username,
        password: this.password
      };

      this.authService.login(loginRequest).subscribe({
        next: (response) => {
          this.loading = false;
          this.router.navigate(['/menu/dashboard']);
        },
        error: (error) => {
          this.loading = false;
          this.loginError = true;
          this.errorMessage = error.error?.message || 'Usuario o contraseña incorrectos';
        }
      });
    } else {
      this.loginError = true;
      this.errorMessage = 'Por favor complete todos los campos';
    }
  }
}
