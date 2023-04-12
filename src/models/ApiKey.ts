import { Column } from "typeorm";

export default class ApiKey {
  @Column()
  hash!: string;
}
