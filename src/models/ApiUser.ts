import { Entity, Column, ManyToOne } from "typeorm";
import ApiKey from "./ApiKey";
import User from "./User";
import Contact from "./Contact";

@Entity()
export default class ApiUser extends User {
  @ManyToOne("Contact")
  creator!: Contact;

  @Column(() => ApiKey)
  apikey!: ApiKey;
}
