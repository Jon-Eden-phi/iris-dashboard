import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  auth = inject(AuthService);
  router = inject(Router);

  email = signal('');
  password = signal('');
  error = signal('');
  loading = signal(false);

  setEmail(v: string): void { this.email.set(v); }
  setPassword(v: string): void { this.password.set(v); }

  submit(): void {
    this.error.set('');
    if (!this.email() || !this.password()) {
      this.error.set('Please enter your email and password.');
      return;
    }
    this.loading.set(true);
    setTimeout(() => {
      const ok = this.auth.login(this.email(), this.password());
      if (ok) {
        const role = this.auth.currentUser()?.role;
        const dest = role === 'Client' ? '/client-portal'
                   : role === 'Purchasing' ? '/transactions-portal'
                   : role === 'Legal Provider' ? '/legal-portal'
                   : '/pipeline';
        this.router.navigate([dest]);
      } else {
        this.error.set('Invalid email or password.');
      }
      this.loading.set(false);
    }, 380);
  }
}
