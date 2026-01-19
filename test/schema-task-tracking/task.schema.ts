import Task from "./task.entity";
import Project from "./project.entity";
import User from "./user.entity";
import { EntitySchema } from "typeorm";

export const TaskSchema = new EntitySchema<Task>({
  name: "Tasks",
  tableName: "tasks",
  target: Task,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    title: {
      type: "varchar",
    },
    status: {
      type: "varchar",
    },
  },
  relations: {
    project: {
      type: "many-to-one",
      target: () => Project,
      inverseSide: "tasks",
      nullable: false,
      joinColumn: { name: "project_id" },
    },
    users: {
      type: "many-to-many",
      target: () => User,
      inverseSide: "tasks",
    },
  },
});
