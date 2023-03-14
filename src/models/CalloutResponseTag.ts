import { CreateDateColumn, Entity, ManyToOne } from "typeorm";
import CalloutResponse from "./CalloutResponse";
import CalloutTag from "./CalloutTag";

@Entity({})
export default class CalloutResponseTag {
  @ManyToOne("CalloutResponse", "tags", { primary: true })
  response!: CalloutResponse;

  @ManyToOne("CalloutTag", { primary: true })
  tag!: CalloutTag;

  @CreateDateColumn()
  date!: Date;
}
