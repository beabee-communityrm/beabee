import { CreateDateColumn, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import Segment from './Segment';

@Entity()
export default class SegmentMember {
  @ManyToOne(() => Segment, {primary: true})
  segment!: Segment

  @PrimaryColumn()
  memberId!: string

  @CreateDateColumn()
  date!: Date
}
