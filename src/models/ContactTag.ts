import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export default class ContactTag {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  @Index({ unique: true })
  name!: string;

  @Column()
  description!: string;
}
