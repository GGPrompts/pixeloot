export class Pool<T> {
  private pool: T[] = [];

  constructor(private factory: () => T, prealloc = 0) {
    for (let i = 0; i < prealloc; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire(): T {
    return this.pool.pop() ?? this.factory();
  }

  release(item: T): void {
    this.pool.push(item);
  }
}
