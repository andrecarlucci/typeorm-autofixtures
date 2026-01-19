import { EntityTarget } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";

export class FixtureRelationHelper<T> {
  public relationType: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
  public sourceTypeName: string;
  public sourceType: EntityTarget<any>;
  public sourcePropertyName: string;
  public isNullable: boolean;
  public targetPropertyName: string;
  public targetTypeName: string;
  public targetType: EntityTarget<any>;
  public instance: T;
  public providedValue: any;

  public constructor(instance: T, relation: RelationMetadata, providedValues: Partial<T>) {
    this.relationType = relation.relationType;
    this.sourceTypeName = relation.entityMetadata.name;
    this.sourceType = relation.entityMetadata.target as EntityTarget<any>;
    this.sourcePropertyName = relation.propertyName;
    this.isNullable = relation.isNullable;
    this.targetTypeName = relation.inverseEntityMetadata.name;
    this.targetType = relation.inverseEntityMetadata.target as EntityTarget<any>;
    this.targetPropertyName = relation.inverseRelation
      ? relation.inverseRelation.propertyName
      : relation.inverseSidePropertyPath;
    this.instance = instance;
    this.providedValue = providedValues[this.getSourcePropertyName()];
  }

  private getSourcePropertyName(): keyof T {
    return this.sourcePropertyName as keyof T;
  }

  public userProvidedValue(): boolean {
    return this.providedValue !== undefined;
  }

  public setInstanceProperty(value: any): void {
    this.instance[this.getSourcePropertyName()] = value;
  }

  public addValueToInstanceArray(value: any): void {
    if (!this.instance[this.getSourcePropertyName()]) {
      this.instance[this.getSourcePropertyName()] = [] as any;
    }
    (this.instance[this.getSourcePropertyName()] as any).push(value);
  }

  public addThisInstanceToTheTargetSideArray(targetSide: any): void {
    if (this.targetPropertyName) {
      if (!targetSide[this.targetPropertyName]) {
        targetSide[this.targetPropertyName] = [];
      }
      targetSide[this.targetPropertyName].push(this.instance);
    }
  }

  public getLogMessage(suffix: string): string {
    return `${this.relationType.toUpperCase()} for ${this.sourceTypeName}.${this.sourcePropertyName} -> ${
      this.targetTypeName
    }.${this.targetPropertyName}: ${suffix}`;
  }
}
