import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwLocalService } from '../hw-local.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hw-local',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-local.component.html',
  styleUrls: ['./hw-local.component.css']
})
export class HwLocalComponent implements OnInit {

  hwLocalList: any[] = [];
  hwLocalForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private hwLocalService: HwLocalService, private fb: FormBuilder) {
    this.hwLocalForm = this.fb.group({
      nroSoftware: [''],
      subred: [''],
      piso: [''],
      oficina: [''],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.hwLocalList = this.hwLocalService.getHwLocal();
  }

  agregarHwLocal(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.hwLocalList[this.currentEditIndex] = this.hwLocalForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.hwLocalList.push(this.hwLocalForm.value);
    }
    this.hwLocalForm.reset();
  }

  eliminarHwLocal(id: number): void {
    this.hwLocalList = this.hwLocalList.filter(hw => hw.nroSoftware !== id);
  }

  editarHwLocal(index: number): void {
    const hwLocal = this.hwLocalList[index];
    this.hwLocalForm.patchValue(hwLocal);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.hwLocalForm.reset();
  }
}
