import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { ContentId } from "@type/content-id";

@Entity()
export default class Content {
  @PrimaryColumn()
  id!: ContentId;

  @UpdateDateColumn()
  updated!: Date;

  @Column({ type: "jsonb" })
  data!: Record<string, unknown>;
}
