import { EntitySchema } from "typeorm";
import Team from "./team.entity";

export const TeamSchema = new EntitySchema<Team>({
  name: "Teams",
  tableName: "teams",
  target: Team,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    name: {
      type: "varchar",
      unique: true,
    },
    code: {
      type: "varchar",
      length: "15",
    },
    description: {
      type: "varchar",
    },
  },
  uniques: [
    {
      columns: ["code"],
    },
  ],
});
