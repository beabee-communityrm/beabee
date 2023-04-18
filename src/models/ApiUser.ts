import { ChildEntity, Column, ManyToOne } from "typeorm";
import ApiKey from "./ApiKey";
import AppUser from "./AppUser";
import Contact from "./Contact";

@ChildEntity()
export default class ApiUser extends AppUser {
  @ManyToOne("Contact")
  creator!: Contact;

  @Column(() => ApiKey)
  apiKey!: ApiKey;
}
