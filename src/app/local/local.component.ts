import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LocalService } from '../local.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-local',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './local.component.html',
  styleUrls: ['./local.component.css']
})
export class LocalComponent implements OnInit {

  localList: any[] = [];
  localForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private localService: LocalService, private fb: FormBuilder) {
    this.localForm = this.fb.group({
      subred: [''],
      piso: [''],
      oficina: [''],
      zona: [''],
      ciudad: [''],
      local: [''],
      direccion: ['']
    });
  }

  ngOnInit(): void {
    this.localList = this.localService.getLocal();
  }

  agregarLocal(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.localList[this.currentEditIndex] = this.localForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.localList.push(this.localForm.value);
    }
    this.localForm.reset();
  }

  eliminarLocal(id: number): void {
    this.localList = this.localList.filter(local => local.subred !== id);
  }

  editarLocal(index: number): void {
    const local = this.localList[index];
    this.localForm.patchValue(local);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.localForm.reset();
  }
}
