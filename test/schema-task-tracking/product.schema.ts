import { EntitySchema } from "typeorm";
import Product from "./product.entity";

export const ProductSchema = new EntitySchema<Product>({
  name: "Products",
  tableName: "products",
  target: Product,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    _title: {
      type: "varchar",
    },
  },
});
