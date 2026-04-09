export default class Product {
  public id!: number;

  // Private backing field — TypeORM metadata propertyName is "_title",
  // but the class exposes a getter/setter "title"
  public _title!: string;

  get title(): string {
    return this._title;
  }

  set title(value: string) {
    this._title = value;
  }
}
