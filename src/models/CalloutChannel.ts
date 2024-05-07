import { CalloutChannel as CalloutChannelEnum } from "@beabee/beabee-common";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import Callout from "./Callout";

@Entity()
export default class CalloutChannel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: CalloutChannelEnum;

  @Column()
  description!: string;

  @Column()
  calloutId!: string;
  @ManyToOne("Callout")
  callout!: Callout;
}
