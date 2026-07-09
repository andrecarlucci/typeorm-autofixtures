import { EntitySchema } from "typeorm";
import Passport from "./passport.entity";
import Citizen from "./citizen.entity";

export const PassportSchema = new EntitySchema<Passport>({
  name: "Passports",
  tableName: "passports",
  target: Passport,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    code: {
      type: "varchar",
    },
  },
  relations: {
    // Owning one-to-one with cascade: TypeORM re-manages (replaces) the relation
    // reference on save, which is what makes the echo guarantee necessary.
    citizen: {
      type: "one-to-one",
      target: () => Citizen,
      joinColumn: { name: "citizen_id" },
      nullable: false,
      cascade: ["insert", "update"],
    },
  },
});
