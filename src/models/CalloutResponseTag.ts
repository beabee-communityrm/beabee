import { CreateDateColumn, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import CalloutResponse from "./CalloutResponse";
import CalloutTag from "./CalloutTag";

@Entity({})
export default class CalloutResponseTag {
  @PrimaryColumn()
  responseId!: string;
  @ManyToOne("CalloutResponse", "tags")
  response!: CalloutResponse;

  @PrimaryColumn()
  tagId!: string;
  @ManyToOne("CalloutTag")
  tag!: CalloutTag;

  @CreateDateColumn()
  date!: Date;
}
