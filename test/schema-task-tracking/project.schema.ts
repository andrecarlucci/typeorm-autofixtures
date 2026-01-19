import Project from "./project.entity";
import Task from "./task.entity";
import { EntitySchema } from "typeorm";

export const ProjectSchema = new EntitySchema<Project>({
  name: "Projects",
  tableName: "projects",
  target: Project,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    name: {
      type: "varchar",
    },
    deadline: {
      type: "timestamp",
    },
  },
  relations: {
    tasks: {
      type: "one-to-many",
      target: () => Task,
      inverseSide: "project",
      cascade: ["insert", "update"],
    },
  },
});
