import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

export type ContentId =
  | "join"
  | "join/setup"
  | "profile"
  | "general"
  | "contacts"
  | "share"
  | "email";

@Entity()
export default class Content {
  @PrimaryColumn()
  id!: ContentId;

  @UpdateDateColumn()
  updated!: Date;

  @Column({ type: "jsonb" })
  data!: object;
}
