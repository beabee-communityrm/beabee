import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import Callout from "./Callout";

@Entity()
export default class CalloutTag {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column()
  description!: string;

  @Column()
  calloutId!: string;
  @ManyToOne("Callout")
  callout!: Callout;
}
