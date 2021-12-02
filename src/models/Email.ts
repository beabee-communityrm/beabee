import juice from "juice";

import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type EmailMailing from "./EmailMailing";

@Entity()
export default class Email {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  name!: string;

  @Column()
  fromName!: string;

  @Column()
  fromEmail!: string;

  @Column()
  subject!: string;

  @Column({ type: "text" })
  body!: string;

  @OneToMany("EmailMailing", "email")
  mailings!: EmailMailing[];

  mailingCount?: number;

  get bodyInline(): string {
    return juice(
      "<style>p,ul,ol,h1,h2,h3,h4,h5,h6,pre,blockquote { margin: 0; }</style>" +
        this.body
    );
  }
}
