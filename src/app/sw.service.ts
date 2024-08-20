import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SwService {

  constructor() { }

  getSoftware() {
    return [
      { 
        nroSoftware: 1, 
        nombre: 'Microsoft Office 365', 
        version: '2021', 
        licencia: 'Office365-AB123', 
        fechaInstalacion: '2023-01-15', 
        nroProveedor: 101 
      },
      { 
        nroSoftware: 2, 
        nombre: 'Adobe Photoshop', 
        version: '2022', 
        licencia: 'Photoshop-XY789', 
        fechaInstalacion: '2023-02-20', 
        nroProveedor: 102 
      },
      { 
        nroSoftware: 3, 
        nombre: 'AutoCAD', 
        version: '2023', 
        licencia: 'AutoCAD-CD456', 
        fechaInstalacion: '2023-03-05', 
        nroProveedor: 103 
      },
      { 
        nroSoftware: 4, 
        nombre: 'Visual Studio Code', 
        version: '1.70.2', 
        licencia: 'Open Source', 
        fechaInstalacion: '2023-04-10', 
        nroProveedor: 104 
      },
      { 
        nroSoftware: 5, 
        nombre: 'Slack', 
        version: '4.23.0', 
        licencia: 'SlackFree', 
        fechaInstalacion: '2023-05-01', 
        nroProveedor: 105 
      },
      { 
        nroSoftware: 6, 
        nombre: 'MySQL Workbench', 
        version: '8.0.29', 
        licencia: 'Open Source', 
        fechaInstalacion: '2023-06-12', 
        nroProveedor: 106 
      },
      { 
        nroSoftware: 7, 
        nombre: 'Git', 
        version: '2.37.1', 
        licencia: 'Open Source', 
        fechaInstalacion: '2023-07-05', 
        nroProveedor: 107 
      },
      { 
        nroSoftware: 8, 
        nombre: 'Node.js', 
        version: '16.17.0', 
        licencia: 'Open Source', 
        fechaInstalacion: '2023-08-10', 
        nroProveedor: 108 
      },
      { 
        nroSoftware: 9, 
        nombre: 'JIRA', 
        version: '8.20.7', 
        licencia: 'JiraEnterprise', 
        fechaInstalacion: '2023-09-03', 
        nroProveedor: 109 
      },
      { 
        nroSoftware: 10, 
        nombre: 'Postman', 
        version: '9.29.0', 
        licencia: 'PostmanFree', 
        fechaInstalacion: '2023-10-02', 
        nroProveedor: 110 
      }
    ];
  }
}
