import { ConstructorParams } from "../../src/constructor-params";

export default class Citizen {
  public id!: number;
  public name!: string;

  public constructor(params: ConstructorParams<Citizen>) {
    Object.assign(this, params);
  }
}
