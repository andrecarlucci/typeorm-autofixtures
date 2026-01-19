import { EntitySchema } from "typeorm";
import User from "./user.entity";
import Task from "./task.entity";
import UserProfile from "./user-profile.entity";

export const UserSchema = new EntitySchema<User>({
  name: "Users",
  tableName: "users",
  target: User,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    name: {
      type: "varchar",
    },
    email: {
      type: "varchar",
    },
  },
  relations: {
    tasks: {
      type: "many-to-many",
      target: () => Task,
      inverseSide: "users",
      joinTable: true,
      cascade: ["insert", "update"],
    },
    profile: {
      type: "one-to-one",
      target: () => UserProfile,
      inverseSide: "user",
      joinColumn: true,
      cascade: ["insert", "update"],
    },
  },
});
