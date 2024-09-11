import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-asset-edit-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './asset-edit-modal.component.html',
  styleUrl: './asset-edit-modal.component.css'
})
export class AssetEditModalComponent {
  @Input() asset: any;

  constructor(public activeModal: NgbActiveModal) {}

  guardarCambios() {
    this.activeModal.close(this.asset);
  }
}
