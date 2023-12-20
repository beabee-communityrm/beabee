import { ObjectLiteral, SelectQueryBuilder } from "typeorm";

import { Filters, Paginated } from "@beabee/beabee-common";
import {
  FieldHandlers,
  GetPaginatedQuery,
  fetchPaginated
} from "@api/data/PaginatedData";
import Contact from "@models/Contact";

export abstract class BaseTransformer<
  Model extends ObjectLiteral,
  GetDto,
  Query extends GetPaginatedQuery,
  FilterName extends string
> {
  abstract model: { new (): Model };
  abstract filters: Filters<FilterName>;

  fieldHandlers: FieldHandlers<FilterName> | undefined;
  modelIdField = "id";

  abstract convert(
    model: Model,
    query: Query,
    runner: Contact | undefined
  ): GetDto;

  protected transformQuery(query: Query, runner: Contact | undefined): Query {
    return query;
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Model>,
    fieldPrefix: string,
    query: Query
  ): void {}

  protected async modifyResult(
    result: Paginated<Model>,
    query: Query,
    runner: Contact | undefined
  ): Promise<void> {}

  async fetch(query: Query, runner?: Contact): Promise<Paginated<GetDto>> {
    const result = await fetchPaginated(
      this.model,
      this.filters,
      this.transformQuery(query, runner),
      runner,
      this.fieldHandlers,
      (qb, fieldPrefix) => this.modifyQueryBuilder(qb, fieldPrefix, query)
    );

    await this.modifyResult(result, query, runner);

    return {
      ...result,
      items: result.items.map((item) => this.convert(item, query, runner))
    };
  }

  async fetchOne(query: Query, runner?: Contact): Promise<GetDto | undefined> {
    const result = await this.fetch({ ...query, offset: 0, limit: 1 }, runner);
    return result.items[0];
  }

  async fetchOneById(
    id: string,
    runner?: Contact
  ): Promise<GetDto | undefined> {
    const query = {
      rules: {
        condition: "AND",
        rules: [{ field: this.modelIdField, operator: "equal", value: [id] }]
      }
    } as Query;

    return await this.fetchOne(query, runner);
  }
}
