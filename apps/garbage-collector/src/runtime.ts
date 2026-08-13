/** A bounded cleanup operation that can be run repeatedly. */
export interface CleanupOperation {
  run(): Promise<unknown>;
}

/** Starts and stops repeated bounded cleanup passes for one collector instance. */
export class GarbageCollectorRuntime {
  private timer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly cleanup: CleanupOperation,
    private readonly intervalMilliseconds: number,
    private readonly onCleanupFailure: () => void,
  ) {}

  /** Starts the immediate and recurring cleanup loop exactly once. */
  public start(): void {
    if (this.timer !== undefined) {
      return;
    }

    void this.runCleanup();
    this.timer = setInterval(() => {
      void this.runCleanup();
    }, this.intervalMilliseconds);
    this.timer.unref();
  }

  /** Stops future cleanup passes before database connections are closed. */
  public stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Keeps a failed pass retryable on the next interval without leaking storage context. */
  private async runCleanup(): Promise<void> {
    try {
      await this.cleanup.run();
    } catch {
      this.onCleanupFailure();
    }
  }
}
