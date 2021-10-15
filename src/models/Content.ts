import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity()
export default class Content {
  @PrimaryColumn()
  id!: string;

  @UpdateDateColumn()
  updated!: Date;

  @Column({ type: "jsonb" })
  data!: object;
}
