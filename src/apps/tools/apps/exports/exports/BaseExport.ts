import { ObjectLiteral, SelectQueryBuilder } from "typeorm";

import { Param } from "#core/utils/params";

import Export from "#models/Export";
import ExportItem from "#models/ExportItem";

export type ExportResult =
  | Record<string, unknown>[]
  | { fields: string[]; data: unknown[][] };

export default abstract class BaseExport<T extends ObjectLiteral> {
  abstract readonly exportName: string;
  abstract readonly itemName: string;
  abstract readonly itemStatuses: string[];
  abstract readonly idColumn: string;

  protected readonly ex;

  constructor(ex?: Export) {
    this.ex = ex;
  }

  type?: string;
  params?: Param[];

  async getParams(): Promise<Param[]> {
    return [];
  }

  protected abstract get query(): SelectQueryBuilder<T>;

  abstract getExport(items: T[]): Promise<ExportResult>;

  async getItems(status?: string): Promise<T[]> {
    return this.query
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select("ei.itemId")
          .from(ExportItem, "ei")
          .where("ei.exportId = :exportId");

        if (status) {
          subQuery.andWhere("ei.status = :status");
        }
        return `${this.idColumn}::text IN ` + subQuery.getQuery();
      })
      .setParameters({ exportId: this.ex!.id, status })
      .getMany();
  }

  protected getNewItemsQuery(): SelectQueryBuilder<T> {
    return this.query
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select("ei.itemId")
          .from(ExportItem, "ei")
          .where("ei.exportId = :exportId");

        return `${this.idColumn}::text NOT IN ` + subQuery.getQuery();
      })
      .setParameters({ exportId: this.ex!.id });
  }

  async getNewItems(): Promise<T[]> {
    return await this.getNewItemsQuery().getMany();
  }

  async getNewItemIds(): Promise<string[]> {
    return (
      await this.getNewItemsQuery().select(this.idColumn, "id").getRawMany()
    ).map((item) => item.id);
  }
}
