# Cerbero

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.0.

## Gráficas del dashboard (Chart.js)

El panel de control usa **Chart.js** (licencia MIT, gratis) con `ng2-charts` y `chartjs-plugin-datalabels`. **No usa CanvasJS.**

Tras clonar el repo, en esta carpeta (`Cerbero/`):

```bash
npm install
```

Eso alcanza: `chart.js`, `ng2-charts` y `chartjs-plugin-datalabels` ya están en `package.json`. Si faltan (clone incompleto, `node_modules` viejo o error al cargar el dashboard):

```bash
npm install chart.js ng2-charts chartjs-plugin-datalabels
```

Código: `src/app/dashboard/dashboard.component.ts` y `src/app/dashboard/dashboard-charts.ts`.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
