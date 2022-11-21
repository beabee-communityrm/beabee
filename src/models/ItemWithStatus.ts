import { ItemStatus } from "@beabee/beabee-common";
import moment from "moment";
import { Column } from "typeorm";

export default class ItemWithStatus {
  @Column({ type: Date, nullable: true })
  starts!: Date | null;

  @Column({ type: Date, nullable: true })
  expires!: Date | null;

  get status(): ItemStatus {
    const now = moment.utc();
    if (this.starts === null) {
      return ItemStatus.Draft;
    }
    if (now.isBefore(this.starts)) {
      return ItemStatus.Scheduled;
    }
    if (this.expires && now.isAfter(this.expires)) {
      return ItemStatus.Ended;
    }
    return ItemStatus.Open;
  }

  get active(): boolean {
    return this.status === ItemStatus.Open;
  }
}
