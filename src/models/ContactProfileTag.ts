import { CreateDateColumn, Entity, ManyToOne } from "typeorm";
import ContactProfile from "./ContactProfile";
import ContactTag from "./ContactTag";

@Entity({})
export default class ContactProfileTag {
  @ManyToOne("ContactProfile", "tags", { primary: true })
  profile!: ContactProfile;

  @ManyToOne("ContactTag", { primary: true })
  tag!: ContactTag;

  @CreateDateColumn()
  date!: Date;
}
