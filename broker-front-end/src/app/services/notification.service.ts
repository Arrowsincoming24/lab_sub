// Watermark: Aarav Joshi
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toasts: Toast[] = [];
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();
  private idCounter = 0;

  show(type: Toast['type'], title: string, message: string, duration: number = 5000): void {
    const toast: Toast = {
      id: ++this.idCounter,
      type,
      title,
      message,
      duration
    };

    this.toasts.push(toast);
    this.toastsSubject.next([...this.toasts]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }

  success(title: string, message: string, duration?: number): void {
    this.show('success', title, message, duration);
  }

  error(title: string, message: string, duration?: number): void {
    this.show('error', title, message, duration);
  }

  warning(title: string, message: string, duration?: number): void {
    this.show('warning', title, message, duration);
  }

  info(title: string, message: string, duration?: number): void {
    this.show('info', title, message, duration);
  }

  dismiss(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.toastsSubject.next([...this.toasts]);
  }

  dismissAll(): void {
    this.toasts = [];
    this.toastsSubject.next([]);
  }
}
