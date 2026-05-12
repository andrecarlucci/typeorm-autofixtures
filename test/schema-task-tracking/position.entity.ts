import { ConstructorParams } from "../../src/constructor-params";
import Company from "./company.entity";

export default class Position {
  public id!: number;
  public name!: string;
  public title!: string;
  public companyId!: number;
  public company!: Company;

  public constructor(params: ConstructorParams<Position>) {
    Object.assign(this, params);
  }
}
