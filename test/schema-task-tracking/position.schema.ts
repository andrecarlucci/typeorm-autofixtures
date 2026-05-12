import { EntitySchema } from "typeorm";
import Position from "./position.entity";
import Company from "./company.entity";

export const PositionSchema = new EntitySchema<Position>({
  name: "Positions",
  tableName: "positions",
  target: Position,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    name: {
      type: "varchar",
    },
    title: {
      type: "varchar",
    },
    companyId: {
      type: "int",
      name: "company_id",
    },
  },
  relations: {
    company: {
      type: "many-to-one",
      target: () => Company,
      nullable: false,
      joinColumn: { name: "company_id" },
    },
  },
  uniques: [
    {
      columns: ["companyId", "name"],
    },
  ],
  indices: [
    {
      columns: ["companyId", "title"],
      unique: true,
    },
  ],
});
