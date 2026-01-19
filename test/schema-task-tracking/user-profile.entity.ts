import { ConstructorParams } from "../../src/constructor-params";
import User from "./user.entity";

export default class UserProfile {
  public id!: number;
  public picture!: string;
  public user!: User;

  public constructor(params: ConstructorParams<UserProfile>) {
    Object.assign(this, params);
  }
}
