import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SwService } from '../sw.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './software.component.html',
  styleUrls: ['./software.component.css']
})
export class SoftwareComponent implements OnInit {

  softwareList: any[] = [];
  softwareForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private swService: SwService, private fb: FormBuilder) {
    this.softwareForm = this.fb.group({
      nroSoftware: [''],
      nombre: [''],
      version: [''],
      licencia: [''],
      fechaInstalacion: [''],
      nroProveedor: ['']
    });
  }

  ngOnInit(): void {
    this.softwareList = this.swService.getSoftware();
  }

  agregarSoftware(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.softwareList[this.currentEditIndex] = this.softwareForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.softwareList.push(this.softwareForm.value);
    }
    this.softwareForm.reset();
  }

  eliminarSoftware(id: number): void {
    this.softwareList = this.softwareList.filter(sw => sw.nroSoftware !== id);
  }

  editarSoftware(index: number): void {
    const software = this.softwareList[index];
    this.softwareForm.patchValue(software);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.softwareForm.reset();
  }
}
