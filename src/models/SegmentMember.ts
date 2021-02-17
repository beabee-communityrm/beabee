import { Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import Segment from './Segment';

@Entity()
export default class SegmentMember {
  @ManyToOne(() => Segment, {primary: true})
  segment!: Segment

  @PrimaryColumn()
  memberId!: string
}
