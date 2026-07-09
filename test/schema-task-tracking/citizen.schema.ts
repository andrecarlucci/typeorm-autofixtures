import { EntitySchema } from "typeorm";
import Citizen from "./citizen.entity";

export const CitizenSchema = new EntitySchema<Citizen>({
  name: "Citizens",
  tableName: "citizens",
  target: Citizen,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    name: {
      type: "varchar",
    },
  },
});
