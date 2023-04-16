import { Entity, Column, ManyToOne } from "typeorm";
import ApiKey from "./ApiKey";
import AppUser from "./AppUser";
import Contact from "./Contact";

@Entity()
export default class ApiUser extends AppUser {
  @ManyToOne("Contact")
  creator!: Contact;

  @Column(() => ApiKey)
  apiKey!: ApiKey;
}
