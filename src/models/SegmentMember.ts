import { CreateDateColumn, Entity, ManyToOne } from 'typeorm';

import type Member from './Member';
import type Segment from './Segment';

@Entity()
export default class SegmentMember {
  @ManyToOne('Segment', 'members', {primary: true})
  segment!: Segment

  @ManyToOne('Member', {primary: true})
  member!: Member

  @CreateDateColumn()
  date!: Date
}
