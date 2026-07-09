import { ConstructorParams } from "../../src/constructor-params";

export default class Event {
  public id!: number;
  public name!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  public constructor(params: ConstructorParams<Event>) {
    Object.assign(this, params);
  }
}
