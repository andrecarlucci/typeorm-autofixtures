import { ConstructorParams } from "../../src/constructor-params";
import Task from "./task.entity";
import UserProfile from "./user-profile.entity";

export default class User {
  public id!: number;
  public name!: string;
  public email!: string;
  public tasks!: Task[];
  public profile!: UserProfile;

  public constructor(params: ConstructorParams<User>) {
    Object.assign(this, params);
  }
}
