import { ConstructorParams } from "../../src/constructor-params";
import Citizen from "./citizen.entity";

export default class Passport {
  public id!: number;
  public code!: string;
  public citizenId!: number;
  public citizen!: Citizen;

  public constructor(params: ConstructorParams<Passport>) {
    Object.assign(this, params);
  }
}
