import { ConstructorParams } from "../../src/constructor-params";

export default class Team {
  public id!: number;
  public name!: string;
  public code!: string;
  public description!: string;

  public constructor(params: ConstructorParams<Team>) {
    Object.assign(this, params);
  }
}
