import { ManyToOne, PrimaryColumn } from 'typeorm';
import Segment from './Segment';

export default class SegmentMember {
  @ManyToOne(() => Segment, {primary: true})
  segment!: Segment

  @PrimaryColumn()
  memberId!: string
}
