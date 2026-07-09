import { EntitySchema } from "typeorm";
import Event from "./event.entity";

export const EventSchema = new EntitySchema<Event>({
  name: "Events",
  tableName: "events",
  target: Event,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    name: {
      type: "varchar",
    },
    createdAt: {
      type: "timestamp",
      createDate: true,
      name: "created_at",
    },
    updatedAt: {
      type: "timestamp",
      updateDate: true,
      name: "updated_at",
    },
  },
});
