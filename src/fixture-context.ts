import ArrayHelper from './array-helper';

export class FixtureContext {
  public dictionary: TypeRegistry = new TypeRegistry();

  public getLast<T>(type: Ctor<T>): T | undefined {
    const array = this.dictionary.get(type);
    return array ? ArrayHelper.last(array) : undefined;
  }

  public count<T>(type: Ctor<T>): number {
    const array = this.dictionary.get(type);
    return array ? array.length : 0;
  }

  public merge(otherContext: FixtureContext): void {
    this.dictionary.merge(otherContext.dictionary);
  }
}

export type Ctor<T = object> = { prototype: T };

export class TypeRegistry {
  public map = new Map<Ctor<any>, any[]>();

  public set<T>(classReference: Ctor<T>, instances: T[]): void {
    this.map.set(classReference, instances);
  }

  public get<T>(classReference: Ctor<T>): T[] | undefined {
    return this.map.get(classReference) as T[] | undefined;
  }

  public getOrCreate<T>(classReference: Ctor<T>, factory: () => T[]): T[] {
    const existing = this.get(classReference);
    if (existing) {
      return existing;
    }
    const created = factory();
    this.set(classReference, created);
    return created;
  }

  public merge(otherRegistry: TypeRegistry): void {
    for (const [key, value] of otherRegistry.map.entries()) {
      const existingArray = this.getOrCreate(key, () => []);
      existingArray.push(...value);
    }
  }
}
