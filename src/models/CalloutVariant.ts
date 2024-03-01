import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import type Callout from "./Callout";
import { CalloutVariantNavigationData } from "@type/callout-variant-data";

@Entity()
export default class CalloutVariant {
  @PrimaryColumn()
  calloutId!: string;
  @ManyToOne("Callout")
  callout!: Callout;

  @PrimaryColumn()
  name!: string;

  @Column()
  title!: string;

  @Column()
  excerpt!: string;

  @Column()
  intro!: string;

  @Column()
  thanksTitle!: string;

  @Column()
  thanksText!: string;

  @Column({ type: String, nullable: true })
  thanksRedirect!: string | null;

  @Column({ type: String, nullable: true })
  shareTitle!: string | null;

  @Column({ type: String, nullable: true })
  shareDescription!: string | null;

  @Column({ type: "jsonb" })
  slideNavigation!: Record<string, CalloutVariantNavigationData>;

  @Column({ type: "jsonb" })
  componentText!: Record<string, string>;
}
