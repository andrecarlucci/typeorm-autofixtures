/* eslint-disable no-console */
import { randomUUID } from "crypto";
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";
import { DataSource, EntityManager, EntityMetadata, EntityTarget, FindOptionsWhere, ObjectLiteral } from "typeorm";
import { FixtureRelationHelper } from "./fixture-relation.helper";

export class Fixture {
  private repository: EntityManager;
  private context = new Map<string, any[]>();
  private contextHistory = new Map<string, number>();
  private static globalCounter = 0;
  public static IsLogEnabled = false;

  public constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.manager;
  }

  public async create<T>(type: EntityTarget<T>, providedValues: Partial<T> = {}): Promise<T> {
    const meta = this.dataSource.getMetadata(type);
    this.log(`===> User Call: Create ${meta.name} ===`);
    const instance = await this.createInternal(type, providedValues);
    await this.repository.save(instance);
    await this.applyProvidedTimestampOverrides(instance, meta, providedValues);
    return instance;
  }

  private async createInternal<T>(type: EntityTarget<T>, providedValues: Partial<T> = {}): Promise<T> {
    const meta = this.dataSource.getMetadata(type);
    const instance = Object.create((meta.target as any).prototype) as T;
    this.log(`### Create ${meta.name} Started`);
    this.handleScalarColumns(instance, meta, providedValues);
    this.assignProvidedValuesToInstance(instance, meta, providedValues);
    this.addToContext(instance, meta.name);
    if (this.allRequiredColumnsAreSet(instance, meta)) {
      await this.repository.save(instance);
    }
    await this.handleOneToOne(instance, meta, providedValues);
    await this.handleManyToOne(instance, meta, providedValues);
    await this.handleOneToMany(instance, meta, providedValues);
    await this.handleManyToMany(instance, meta, providedValues);

    await this.repository.save(instance);
    await this.applyProvidedTimestampOverrides(instance, meta, providedValues);
    this.logInstanceCreated(instance, meta);
    return instance;
  }

  /**
   * TypeORM overwrites `@CreateDateColumn` / `@UpdateDateColumn` values on insert and update, so a
   * value the user passed as an override is lost after `save`. This detects such an override and
   * re-applies it with an explicit follow-up UPDATE (which does not auto-touch the timestamps),
   * then mirrors the value back onto the instance. Useful for controlling ordering/history in tests.
   */
  private async applyProvidedTimestampOverrides<T>(
    instance: T,
    meta: EntityMetadata,
    providedValues: Partial<T>,
  ): Promise<void> {
    const updates: Record<string, any> = {};
    for (const column of meta.columns) {
      if (!column.isCreateDate && !column.isUpdateDate) {
        continue;
      }
      const provided = this.resolveProvidedValue(instance, column, providedValues);
      if (provided !== undefined) {
        instance[column.propertyName as keyof T] = provided as any;
        updates[column.propertyName] = provided;
      }
    }
    if (Object.keys(updates).length === 0) {
      return;
    }
    const criteria: Record<string, any> = {};
    for (const pk of meta.primaryColumns) {
      criteria[pk.propertyName] = instance[pk.propertyName as keyof T];
    }
    await this.repository.update(meta.target as EntityTarget<any>, criteria, updates as any);
  }

  private logInstanceCreated<T>(instance: T, meta: EntityMetadata): void {
    const primaryKeyColumnName = meta.primaryColumns[0].propertyName;
    const primaryKeyValue = instance[primaryKeyColumnName as keyof T];
    this.log(`### Created ${meta.name}. PK: ${primaryKeyColumnName} = ${primaryKeyValue}`);
  }

  /**
   * Creates `times` entities of the given type.
   *
   * The third argument can be either a single `Partial<T>` applied to every entity, or a factory
   * callback `(index) => Partial<T>` invoked per item — use the callback when each entity needs its
   * own values (e.g. distinct names): `createMany(3, User, (i) => ({ fullName: \`Person ${i}\` }))`.
   */
  public async createMany<T>(
    times: number,
    type: EntityTarget<T>,
    providedValues: Partial<T> | ((index: number) => Partial<T>) = {},
  ): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < times; i++) {
      const values = typeof providedValues === "function" ? providedValues(i) : providedValues;
      results.push(await this.create(type, values));
    }
    return results;
  }

  /**
   * Find-or-create: returns the first entity matching `where`, or creates a new one if none exists.
   *
   * Replaces hand-rolled find-or-create test helpers such as:
   *
   * ```typescript
   * const existing = await repo.findOne({ where: { company: { id: company.id }, level } });
   * return existing ?? repo.save(Rank.create(level, company));
   * ```
   *
   * with a single call:
   *
   * ```typescript
   * const rank = await fixture.getOrCreate(Rank, { company: { id: company.id }, level }, { company });
   * ```
   *
   * `where` is a standard TypeORM find condition used to locate an existing row. When nothing
   * matches, a new entity is created via `create`, using `{ ...where, ...extras }` as the provided
   * values — so `extras` is where you pass the real relation instances or extra required fields
   * that are only needed at creation time (and it wins over `where` on key collisions).
   *
   * Whichever path runs, the returned entity is placed in the context like a freshly created one,
   * so later `create` calls can reuse it.
   *
   * @param type entity to look up or create
   * @param where TypeORM find condition used to locate an existing row
   * @param extras creation-only overrides, merged over `where` when a new entity must be created
   */
  public async getOrCreate<T extends ObjectLiteral>(
    type: EntityTarget<T>,
    where: FindOptionsWhere<T>,
    extras: Partial<T> = {},
  ): Promise<T> {
    const meta = this.dataSource.getMetadata(type);
    this.log(`===> User Call: GetOrCreate ${meta.name} ===`);
    const existing = await this.repository.findOne(type, { where });
    if (existing) {
      this.log(`### Found existing ${meta.name}, reusing`);
      this.addToContext(existing, meta.name);
      return existing;
    }
    this.log(`### No existing ${meta.name} matched, creating`);
    return this.create(type, { ...where, ...extras } as Partial<T>);
  }

  private allRequiredColumnsAreSet<T>(instance: T, meta: EntityMetadata): boolean {
    let foundRequiredWithNull = false;
    for (const column of meta.columns) {
      const name = column.propertyName;
      if (column.generationStrategy === "increment" || column.isNullable) {
        continue;
      }
      if (instance[name as keyof T] === undefined || instance[name as keyof T] === null) {
        foundRequiredWithNull = true;
        break;
      }
    }
    return !foundRequiredWithNull;
  }

  private handleScalarColumns<T>(instance: T, meta: EntityMetadata, providedValues: Partial<T>): void {
    for (const column of meta.columns) {
      const name = column.propertyName;
      const provided = this.resolveProvidedValue(instance, column, providedValues);
      if (provided !== undefined) {
        instance[name as keyof T] = provided as any;
        continue;
      }
      if (column.generationStrategy === "increment") {
        continue;
      }
      if (
        column.isNullable ||
        column.relationMetadata ||
        column.isCreateDate ||
        column.isUpdateDate ||
        column.isVersion
      ) {
        continue;
      }
      const isColumnUsedInRelation = meta.relations
        .map((r) => r.joinColumns)
        .map((jcs) => jcs.map((jc) => jc.propertyAliasName))
        .flat();
      if (isColumnUsedInRelation.includes(column.databaseName)) {
        continue;
      }
      instance[name as keyof T] = this.defaultForColumn(column, meta);
    }
  }

  private defaultForColumn(column: ColumnMetadata, meta: EntityMetadata): any {
    const columnType = column.type;

    if (typeof columnType !== "string") {
      return null;
    }
    if (column.default !== undefined && typeof column.default !== "function") {
      return column.default;
    }
    const s = columnType.toLowerCase();
    if (
      ["int", "integer", "bigint", "smallint", "decimal", "numeric", "float", "double", "real"].some((x) =>
        s.includes(x),
      )
    ) {
      return 0;
    }
    if (["bool", "boolean"].some((x) => s.includes(x))) return false;
    if (["date", "time", "timestamp", "datetime"].some((x) => s.includes(x))) return new Date(0);
    if (["json", "jsonb"].some((x) => s.includes(x))) return {};
    if (["uuid"].some((x) => s.includes(x))) return undefined;

    if (columnType.includes("enum") && column.enum) {
      return column.enum[0];
    }

    const max = this.getMaxLengthForColumn(column);

    if (this.isUniqueColumn(column, meta)) {
      const uuidSuffix = `-${this.generateUuidFragment(8)}`;
      if (uuidSuffix.length >= max) {
        return uuidSuffix.slice(-max);
      }
      const prefixBudget = max - uuidSuffix.length;
      const prefix = `${column.propertyName}${this.getIndex(meta.name)}`.substring(0, prefixBudget);
      return `${prefix}${uuidSuffix}`;
    }

    // Use global counter for guaranteed uniqueness across all test runs.
    // The counter persists for the entire test suite run, including across database resets.
    // Trim from the prefix to always preserve the suffix, which contains the uniqueness guarantee.
    Fixture.globalCounter++;
    const counterSuffix = `-${Fixture.globalCounter.toString(36)}`;
    if (counterSuffix.length >= max) {
      return counterSuffix.slice(-max);
    }
    const prefixBudget = max - counterSuffix.length;
    const prefix = `${column.propertyName}${this.getIndex(meta.name)}`.substring(0, prefixBudget);
    return `${prefix}${counterSuffix}`;
  }

  private getMaxLengthForColumn(column: ColumnMetadata): number {
    let max = 255;
    if (column.length !== "" && column.length !== undefined && !isNaN(Number(column.length))) {
      max = Number(column.length);
    }
    return max;
  }

  private isUniqueColumn(column: ColumnMetadata, meta: EntityMetadata): boolean {
    if (column.isPrimary) {
      return false;
    }
    const inUnique = meta.uniques.some((u) => u.columns.some((c) => c.propertyName === column.propertyName));
    if (inUnique) {
      return true;
    }
    return meta.indices.some(
      (i) => i.isUnique && i.columns.some((c) => c.propertyName === column.propertyName),
    );
  }

  public generateUuidFragment(length: number): string {
    return randomUUID().replace(/-/g, "").substring(0, length);
  }

  /**
   * Generates a readable, guaranteed-unique string of the form `${prefix}-{counter}-{fragment}`.
   *
   * Useful for text columns that need app-level uniqueness but have no database unique
   * constraint, so the fixture won't auto-uniquify them on its own. Instead of hand-rolling
   * `` `Market ${Date.now()}-${Math.random().toString(36).slice(2, 8)}` `` in an override,
   * pass a readable prefix and let the fixture guarantee uniqueness:
   *
   * ```typescript
   * const market = await fixture.create(Market, { _name: fixture.unique("Market") });
   * // _name === "Market-1-a3f2b1c0"
   * ```
   *
   * Uniqueness is guaranteed by a monotonic counter (unique within a single process run)
   * combined with a random UUID fragment (guards against collisions across parallel test
   * workers, each of which starts its own counter).
   *
   * @param prefix human-readable prefix, e.g. "Market"
   * @param fragmentLength length of the random UUID fragment appended for cross-process safety (default 8)
   */
  public unique(prefix: string, fragmentLength = 8): string {
    Fixture.globalCounter++;
    const counter = Fixture.globalCounter.toString(36);
    const fragment = this.generateUuidFragment(fragmentLength);
    return `${prefix}-${counter}-${fragment}`;
  }

  /**
   * Resolves the value assigned to a "belongs to" relation (many-to-one / one-to-one) when the
   * user provides an override. If the override is a plain partial object (not an entity instance
   * and not carrying the target's primary key), the target entity is created inline from that
   * partial. Anything else (a real entity instance, or a `{ id }`-style reference) is used as-is.
   */
  private async resolveRelationValue(providedValue: any, targetType: EntityTarget<any>): Promise<any> {
    if (!this.isPartialToCreate(providedValue, targetType)) {
      return providedValue;
    }
    this.log(`### Nested create of ${this.dataSource.getMetadata(targetType).name} from partial`);
    return this.createInternal(targetType, providedValue);
  }

  private isPartialToCreate(value: any, targetType: EntityTarget<any>): boolean {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    if (!this.dataSource.hasMetadata(targetType)) {
      return false;
    }
    const meta = this.dataSource.getMetadata(targetType);
    const targetClass = meta.target;
    if (typeof targetClass === "function" && value instanceof targetClass) {
      return false;
    }
    const carriesAllPrimaryKeys =
      meta.primaryColumns.length > 0 &&
      meta.primaryColumns.every(
        (pk) => value[pk.propertyName] !== undefined && value[pk.propertyName] !== null,
      );
    return !carriesAllPrimaryKeys;
  }

  private assignProvidedValuesToInstance<T>(instance: T, meta: EntityMetadata, params: Partial<T>): void {
    for (const column of meta.columns) {
      const value = this.resolveProvidedValue(instance, column, params);
      if (value !== undefined) {
        instance[column.propertyName as keyof T] = value;
      }
    }
    for (const relation of meta.relations) {
      const value = params[relation.propertyName as keyof T];
      if (value !== undefined) {
        instance[relation.propertyName as keyof T] = value;
      }
    }
  }

  private async handleOneToOne<T>(instance: T, meta: EntityMetadata, params: Partial<T>): Promise<void> {
    for (const relation of meta.relations.filter((r) => r.isOneToOne && !r.isOwning)) {
      const helper = new FixtureRelationHelper(instance, relation, params);

      if (helper.userProvidedValue()) {
        const value = await this.resolveRelationValue(helper.providedValue, helper.targetType);
        helper.setInstanceProperty(value);
        this.log(helper.getLogMessage("Use Provided"));
        continue;
      }

      if (helper.isNullable) {
        this.log(helper.getLogMessage("No Action Because Nullable"));
        continue;
      }

      if (!this.dataSource.hasMetadata(helper.targetType)) {
        this.log(helper.getLogMessage("No Action Because Other Type Not Found"));
        continue;
      }

      this.log(`${helper.getLogMessage("-> Create")}`);
      const created = await this.createInternal(helper.targetType, {
        [helper.targetPropertyName]: instance,
      });
      helper.setInstanceProperty(created);
      this.log(helper.getLogMessage("Assigned"));
    }
  }

  private async handleManyToOne<T>(instance: T, meta: EntityMetadata, params: Partial<T>): Promise<void> {
    for (const relation of meta.relations.filter((r) => r.isManyToOne)) {
      const helper = new FixtureRelationHelper(instance, relation, params);

      if (helper.userProvidedValue()) {
        const value = await this.resolveRelationValue(helper.providedValue, helper.targetType);
        helper.setInstanceProperty(value);
        this.log(helper.getLogMessage("Use Provided Value"));
        helper.addThisInstanceToTheTargetSideArray(value);
        continue;
      }

      if (helper.isNullable) {
        this.log(helper.getLogMessage("No Action Because Nullable"));
        continue;
      }

      const reuse = this.getFromContext(helper.targetTypeName);
      if (reuse) {
        helper.setInstanceProperty(reuse);
        this.log(helper.getLogMessage("Use Cached"));
        continue;
      }

      if (this.dataSource.hasMetadata(helper.targetType)) {
        const createDependencyReferencingMe = {
          [helper.targetPropertyName]: [instance],
        };
        this.log(helper.getLogMessage("Create " + helper.targetTypeName));
        const created = await this.createInternal(helper.targetType, createDependencyReferencingMe);
        helper.setInstanceProperty(created);
      }
    }
  }

  private async handleManyToMany<T>(instance: T, meta: EntityMetadata, providedValues: Partial<T>): Promise<void> {
    for (const relation of meta.relations.filter((r) => r.isManyToMany)) {
      const helper = new FixtureRelationHelper(instance, relation, providedValues);

      if (helper.userProvidedValue()) {
        helper.setInstanceProperty(helper.providedValue);
        this.log(helper.getLogMessage("Use Provided Value"));
        for (const p of helper.providedValue) {
          if (!p[helper.targetPropertyName]) {
            p[helper.targetPropertyName] = [];
          }
          if (relation.isOwning) {
            if (!p[helper.targetPropertyName].includes(instance)) {
              p[helper.targetPropertyName].push(instance);
              await this.repository.save(p);
            }
          }
        }
        helper.addThisInstanceToTheTargetSideArray(helper.providedValue);
        continue;
      }

      const reuse = this.getFromContext(helper.targetTypeName);
      if (reuse) {
        this.log(helper.getLogMessage("Use Cached"));
        if ((instance[helper.sourcePropertyName as keyof T] as any)?.includes(reuse)) {
          //I'm already part of the list
          continue;
        }
        helper.addThisInstanceToTheTargetSideArray(reuse);
        await this.repository.save(reuse);
        helper.addValueToInstanceArray(reuse);
        continue;
      }

      this.log(helper.getLogMessage("No Action"));
    }
  }

  private async handleOneToMany<T>(instance: T, meta: EntityMetadata, params: Partial<T>): Promise<void> {
    for (const relation of meta.relations.filter((r) => r.isOneToMany)) {
      const helper = new FixtureRelationHelper(instance, relation, params);

      if (helper.userProvidedValue()) {
        this.log(helper.getLogMessage("Use Provided"));
        helper.setInstanceProperty(helper.providedValue);
        await this.repository.save(instance);
        continue;
      }

      this.log(helper.getLogMessage("No Action"));
    }
  }

  private resolveProvidedValue<T>(instance: T, column: ColumnMetadata, providedValues: Partial<T>): any {
    // 1. Direct property name match
    const byProperty = providedValues[column.propertyName as keyof T];
    if (byProperty !== undefined) {
      return byProperty;
    }

    // 2. Match by database column name (e.g., @Column({ name: "name" }) on property _name)
    if (column.databaseName !== column.propertyName) {
      const byColumnName = providedValues[column.databaseName as keyof T];
      if (byColumnName !== undefined) {
        return byColumnName;
      }
    }

    // 3. Match by setter on the prototype (e.g., set name() on property _name)
    const prototype = Object.getPrototypeOf(instance);
    if (prototype) {
      for (const key of Object.keys(providedValues)) {
        if (providedValues[key as keyof T] === undefined) continue;
        const descriptor = this.getPropertyDescriptor(prototype, key);
        if (descriptor?.set) {
          // Check if this setter writes to the same backing property
          // by looking if the column propertyName matches the convention _key
          if (column.propertyName === `_${key}` || column.propertyName === key) {
            return providedValues[key as keyof T];
          }
        }
      }
    }

    return undefined;
  }

  private getPropertyDescriptor(prototype: any, key: string): PropertyDescriptor | undefined {
    let proto = prototype;
    while (proto && proto !== Object.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor) return descriptor;
      proto = Object.getPrototypeOf(proto);
    }
    return undefined;
  }

  private addToContext<T>(instance: T, name: string): void {
    if (!this.context.has(name)) {
      this.context.set(name, []);
    }
    this.context.get(name)!.push(instance);

    //indexes
    if (!this.contextHistory.has(name)) {
      this.contextHistory.set(name, 1);
      return;
    }
    this.contextHistory.set(name, this.contextHistory.get(name)! + 1);
  }

  private getFromContext<T>(name: string): T | undefined {
    if (!this.context.has(name)) {
      this.context.set(name, []);
    }
    const items = this.context.get(name)!;
    return items[items.length - 1];
  }

  private getIndex(name: string): number {
    if (!this.contextHistory.has(name)) {
      this.contextHistory.set(name, 1);
    }
    return this.contextHistory.get(name)!;
  }

  /**
   * Resets the context, so previously created entities are no longer reused.
   */
  public resetContext(): void {
    this.context = new Map<string, any>();
    this.log("=== Context Reset ===");
  }

  private resetContextHistory(): void {
    this.contextHistory = new Map<string, number>();
    this.log("=== Context History Reset ===");
  }

  /**
   * Resets the DataSource and the repository used by the Fixture.
   * It's called by TestManager to reset the same instance of Fixture when the DataSource is changed.
   * Other than that, this is only useful when you want to use a different DataSource (e.g., different database connection) in the same test suite.
   */
  public resetDataSource(dataSource: DataSource): void {
    this.dataSource = dataSource;
    this.repository = this.dataSource.manager;
    this.resetContext();
    this.resetContextHistory();
    this.log("=== DataSource Reset ===");
  }

  private log(message: string): void {
    if (!Fixture.IsLogEnabled) {
      return;
    }
    console.log(message);
  }
}
