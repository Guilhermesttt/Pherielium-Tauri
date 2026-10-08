/**
 * Mola estilo SwiftUI (response, dampingFraction), integrada em sub-passos para um
 * quadro perdido nunca desestabilizá-la. Portada de Coucou `windows/src/core/anim.ts`
 * (MIT, Copyright (c) 2026 Louis Raillé).
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  private omega: number;
  private zeta: number;

  constructor(value: number, response = 0.5, damping = 0.72) {
    this.value = value;
    this.target = value;
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  configure(response: number, damping: number) {
    this.omega = (2 * Math.PI) / response;
    this.zeta = damping;
  }

  set(value: number) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled(): boolean {
    return Math.abs(this.target - this.value) < 0.001 && Math.abs(this.velocity) < 0.01;
  }

  step(dt: number) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const acc = this.omega * this.omega * (this.target - this.value) - 2 * this.zeta * this.omega * this.velocity;
      this.velocity += acc * h;
      this.value += this.velocity * h;
    }
  }
}
