import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  mensaje: string;
  tipo: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(mensaje: string, tipo: 'success' | 'error' | 'info' = 'info') {
    const id = Math.random().toString(36).substr(2, 9);
    this.toasts.update(t => [...t, { id, mensaje, tipo }]);
    
    setTimeout(() => {
      this.remove(id);
    }, 4000);
  }

  success(mensaje: string) {
    this.show(mensaje, 'success');
  }

  error(mensaje: string) {
    this.show(mensaje, 'error');
  }

  info(mensaje: string) {
    this.show(mensaje, 'info');
  }

  remove(id: string) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }
}
