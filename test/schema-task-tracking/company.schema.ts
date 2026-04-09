import { EntitySchema } from "typeorm";
import Company from "./company.entity";

export const CompanySchema = new EntitySchema<Company>({
  name: "Companies",
  tableName: "companies",
  target: Company,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    _name: {
      type: "varchar",
      name: "name",
    },
  },
});
