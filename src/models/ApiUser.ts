import { Entity, Column } from "typeorm";
import ApiKey from "./ApiKey";
import User from "./User";

@Entity()
export default class ApiUser extends User {
  @Column(() => ApiKey)
  apikey!: ApiKey;
}
