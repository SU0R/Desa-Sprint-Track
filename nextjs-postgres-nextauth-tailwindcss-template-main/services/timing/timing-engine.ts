export type TimingSnapshot = {
  status: 'Idle' | 'Running' | 'Stopped';
  elapsedMs: number;
  stopReason?: string;
};

type Listener = (snapshot: TimingSnapshot) => void;

export interface TimingEngine {
  start: () => void;
  stop: (reason?: string) => void;
  reset: () => void;
  subscribe: (listener: Listener) => () => void;
}

export class BasicTimingEngine implements TimingEngine {
  private listeners = new Set<Listener>();
  private startedAt: number | null = null;
  private frame: number | null = null;
  private snapshot: TimingSnapshot = {
    status: 'Idle',
    elapsedMs: 0
  };

  start() {
    this.startedAt = performance.now() - this.snapshot.elapsedMs;
    this.snapshot = {
      status: 'Running',
      elapsedMs: this.snapshot.elapsedMs
    };
    this.emit();
    this.tick();
  }

  stop(reason?: string) {
    if (this.startedAt === null) {
      return;
    }

    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    this.snapshot = {
      status: 'Stopped',
      elapsedMs: performance.now() - this.startedAt,
      stopReason: reason
    };
    this.startedAt = null;
    this.emit();
  }

  reset() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    this.startedAt = null;
    this.snapshot = {
      status: 'Idle',
      elapsedMs: 0
    };
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private tick = () => {
    if (this.startedAt === null) {
      return;
    }

    this.snapshot = {
      status: 'Running',
      elapsedMs: performance.now() - this.startedAt
    };
    this.emit();
    this.frame = requestAnimationFrame(this.tick);
  };

  private emit() {
    for (const listener of Array.from(this.listeners)) {
      listener(this.snapshot);
    }
  }
}
