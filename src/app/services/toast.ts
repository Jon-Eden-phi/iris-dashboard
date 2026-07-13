import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  message = signal('');
  icon = signal('ti-check');
  visible = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, icon = 'ti-check'): void {
    if (this.timer) clearTimeout(this.timer);
    this.message.set(message);
    this.icon.set(icon);
    this.visible.set(true);
    this.timer = setTimeout(() => this.visible.set(false), 3200);
  }
}
