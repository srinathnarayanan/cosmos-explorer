export class ObjectCache<T> extends Map<string, T> {
  constructor(private limit: number) {
    super();
  }

  public get(key: string) {
    return this.touch(key);
  }

  public set(key: string, value: T) {
    if (this.size == this.limit) {
      this.delete(this.keys().next().value);
    }

    return this.touch(key, value), this;
  }

  private touch(key: string, value = super.get(key)) {
    // Map keeps (re) insertion order according to ES6 spec
    if (value) {
      this.delete(key);
      super.set(key, value);
    }

    return value;
  }
}
