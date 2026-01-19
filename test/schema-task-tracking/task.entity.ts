import { ConstructorParams } from "../../src/constructor-params";
import Project from "./project.entity";
import User from "./user.entity";

export default class Task {
  public id!: number;
  public project!: Project;
  public title!: string;
  public status!: string;
  public users!: User[];

  public constructor(params: ConstructorParams<Task>) {
    Object.assign(this, params);
  }
}
