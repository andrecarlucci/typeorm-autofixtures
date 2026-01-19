import { EntitySchema } from "typeorm";
import UserProfile from "./user-profile.entity";
import User from "./user.entity";
export const ProfileSchema = new EntitySchema<UserProfile>({
  name: "UserProfile",
  tableName: "user_profile",
  target: UserProfile,
  columns: {
    id: {
      type: "int",
      generated: "increment",
      primary: true,
    },
    picture: {
      type: "text",
    },
  },
  relations: {
    user: {
      type: "one-to-one",
      target: () => User,
      inverseSide: "profile",
      nullable: false,
    },
  },
});
