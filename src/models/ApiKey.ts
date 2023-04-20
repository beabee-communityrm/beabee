import { Column } from "typeorm";

export default class ApiKey {
  @Column()
  id!: string;

  @Column()
  secretHash!: string;

  @Column({ type: String, nullable: true })
  description!: string | undefined;
}
