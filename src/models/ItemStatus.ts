import { ItemStatus } from "@beabee/beabee-common";
import moment from "moment";
import { Brackets, Column, WhereExpressionBuilder } from "typeorm";

import { Rule } from "@core/utils/newRules";

export class ItemWithStatus {
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

export function ruleAsQuery<Field extends string>(
  rule: Rule<Field>,
  qb: WhereExpressionBuilder,
  suffix: string
) {
  if (rule.operator !== "equal") return;

  const now = "now" + suffix;
  switch (rule.value[0]) {
    case ItemStatus.Draft:
      qb.andWhere(`item.starts IS NULL`);
      break;
    case ItemStatus.Scheduled:
      qb.andWhere(`item.starts > :${now}`);
      break;
    case ItemStatus.Open:
      qb.andWhere(`item.starts < :${now}`).andWhere(
        new Brackets((qb) => {
          qb.where("item.expires IS NULL").orWhere(`item.expires > :${now}`);
        })
      );
      break;
    case ItemStatus.Ended:
      qb.andWhere(`item.starts < :${now}`).andWhere(`item.expires < :${now}`);
      break;
  }

  return {
    now: moment.utc().toDate()
  };
}

export default ItemStatus;
