import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-secret-game-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './secret-game-hub.component.html',
  styleUrls: ['./arcade-shared.css', './secret-game-hub.component.css']
})
export class SecretGameHubComponent {}
