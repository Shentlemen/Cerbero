import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { routes } from './app/app-routing';  // Importa las rutas desde tu archivo de rutas

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    provideRouter(routes)  // Añade la configuración del enrutamiento aquí
  ]
}).catch((err) => console.error(err));
