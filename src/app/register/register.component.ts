import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgxParticlesModule, NgParticlesService } from '@tsparticles/angular';
import { loadSlim } from '@tsparticles/slim';
import { IOptions, RecursivePartial } from '@tsparticles/engine';
import { FormsModule } from '@angular/forms';
import { loadPolygonShape } from '@tsparticles/shape-polygon';
import { NgIf } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [NgxParticlesModule, FormsModule, NgIf, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['../home/home.component.css', './register.component.css']
})
export class RegisterComponent implements OnInit {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  firstName = '';
  lastName = '';
  submitting = false;
  errorMessage = '';

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
        density: { enable: true }
      },
      color: { value: ['#ffffff'] },
      shape: { type: 'circle' },
      opacity: { value: 0.7 },
      size: {
        value: { min: 1, max: 4 },
        animation: {
          enable: true,
          speed: 2,
          startValue: 'min',
          sync: false
        }
      },
      wobble: { enable: true, distance: 10, speed: 2 },
      move: {
        enable: true,
        speed: 2,
        direction: 'bottom',
        straight: false,
        random: true,
        outModes: {
          default: 'out',
          bottom: 'out',
          top: 'out'
        }
      }
    },
    interactivity: {
      detectsOn: 'window',
      events: {
        onHover: { enable: true, mode: 'repulse' },
        onClick: { enable: true, mode: 'push' },
        resize: { enable: true, delay: 0.5 }
      },
      modes: {
        repulse: { distance: 200, duration: 0.4 }
      }
    },
    detectRetina: true
  };

  ngOnInit(): void {
    this.ngParticlesService.init(async (engine) => {
      await loadSlim(engine);
      await loadPolygonShape(engine);
    });
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.validate()) {
      return;
    }

    this.submitting = true;
    this.authService.registerPublic({
      username: this.username.trim(),
      email: this.email.trim(),
      password: this.password,
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      role: 'USER'
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/login'], {
          queryParams: { cuentaPendiente: '1' },
          replaceUrl: true
        });
      },
      error: (error) => {
        this.submitting = false;
        this.errorMessage =
          error?.error?.message ||
          error?.message ||
          'No se pudo completar el registro. Revise los datos e intente de nuevo.';
      }
    });
  }

  validate(): boolean {
    if (
      !this.username?.trim() ||
      !this.email?.trim() ||
      !this.password ||
      !this.firstName?.trim() ||
      !this.lastName?.trim()
    ) {
      this.errorMessage = 'Complete todos los campos obligatorios.';
      return false;
    }
    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return false;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return false;
    }
    return true;
  }
}
