import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export default class PageSettings {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  pattern!: string;

  @Column()
  shareUrl!: string;

  @Column()
  shareTitle!: string;

  @Column()
  shareDescription!: string;

  @Column()
  shareImage!: string;
}
