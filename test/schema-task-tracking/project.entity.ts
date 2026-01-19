import { ConstructorParams } from "../../src/constructor-params";
import Task from "./task.entity";

export default class Project {
  public id!: number;
  public name!: string;
  public deadline!: Date;
  public tasks!: Task[];

  public constructor(params: ConstructorParams<Project>) {
    Object.assign(this, params);
  }
}
