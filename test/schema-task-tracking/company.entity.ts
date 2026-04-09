export default class Company {
  public id!: number;

  // Private property with explicit column name mapping
  public _name!: string;

  public constructor(params?: Partial<Company>) {
    if (params) Object.assign(this, params);
  }
}
