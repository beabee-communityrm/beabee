import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique
} from "typeorm";
import Callout from "./Callout";

@Entity()
@Unique(["name", "callout"])
export default class CalloutTag {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column()
  description!: string;

  @ManyToOne("Callout")
  callout!: Callout;
}
