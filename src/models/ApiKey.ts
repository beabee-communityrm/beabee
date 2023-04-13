import { Column } from "typeorm";

export default class ApiKey {
  @Column()
  id!: string;

  @Column()
  secretHash!: string;
}
