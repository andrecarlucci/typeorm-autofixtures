/* eslint-disable no-console */
import { randomUUID } from "crypto";
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";
import { DataSource, EntityManager, EntityMetadata, EntityTarget } from "typeorm";
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
    const name = this.dataSource.getMetadata(type).name;
    this.log(`===> User Call: Create ${name} ===`);
    const instance = await this.createInternal(type, providedValues);
    await this.repository.save(instance);
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
    this.logInstanceCreated(instance, meta);
    return instance;
  }

  private logInstanceCreated<T>(instance: T, meta: EntityMetadata): void {
    const primaryKeyColumnName = meta.primaryColumns[0].propertyName;
    const primaryKeyValue = instance[primaryKeyColumnName as keyof T];
    this.log(`### Created ${meta.name}. PK: ${primaryKeyColumnName} = ${primaryKeyValue}`);
  }

  public async createMany<T>(times: number, type: EntityTarget<T>, providedValues: Partial<T> = {}): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < times; i++) {
      results.push(await this.create(type, providedValues));
    }
    return results;
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
      const provided = providedValues[name as keyof T];
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
    const hasColumnUnique = meta.uniques.some(
      (u) => u.columns.length === 1 && u.columns[0].propertyName === column.propertyName,
    );
    if (hasColumnUnique) {
      return true;
    }
    const hasIndexUnique = meta.indices.some(
      (i) => i.isUnique && i.columns.length === 1 && i.columns[0].propertyName === column.propertyName,
    );
    return hasIndexUnique;
  }

  private generateUuidFragment(length: number): string {
    return randomUUID().replace(/-/g, "").substring(0, length);
  }

  private assignProvidedValuesToInstance<T>(instance: T, meta: EntityMetadata, params: Partial<T>): void {
    for (const column of meta.columns) {
      this.assignProvidedValueToInstance(instance, column.propertyName, params[column.propertyName as keyof T]);
    }
    for (const relation of meta.relations) {
      this.assignProvidedValueToInstance(instance, relation.propertyName, params[relation.propertyName as keyof T]);
    }
  }

  private assignProvidedValueToInstance<T>(instance: T, propertyName: string, provideValue: any): void {
    if (provideValue !== undefined) {
      instance[propertyName as keyof T] = provideValue;
    }
  }

  private async handleOneToOne<T>(instance: T, meta: EntityMetadata, params: Partial<T>): Promise<void> {
    for (const relation of meta.relations.filter((r) => r.isOneToOne && !r.isOwning)) {
      const helper = new FixtureRelationHelper(instance, relation, params);

      if (helper.userProvidedValue()) {
        helper.setInstanceProperty(helper.providedValue);
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
        helper.setInstanceProperty(helper.providedValue);
        this.log(helper.getLogMessage("Use Provided Value"));
        helper.addThisInstanceToTheTargetSideArray(helper.providedValue);
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
