import { ObjectLiteral } from "typeorm";

import { Filters, Paginated } from "@beabee/beabee-common";
import { GetPaginatedQuery, fetchPaginated } from "@api/data/PaginatedData";
import Contact from "@models/Contact";

export abstract class Transformer<
  Model extends ObjectLiteral,
  GetData,
  Query extends Transformer.Query
> {
  abstract model: { new (): Model };
  abstract filters: Filters;
  modelIdField = "id";

  abstract convert(model: Model): GetData;

  protected transformQuery(q: Query, runner: Contact | undefined): Query {
    return q;
  }

  async fetch(q: Query, runner?: Contact): Promise<Paginated<GetData>> {
    const results = await fetchPaginated(
      this.model,
      this.filters,
      this.transformQuery(q, runner)
    );

    return {
      ...results,
      items: results.items.map(this.convert)
    };
  }

  async fetchOne(q: Query, runner?: Contact): Promise<GetData | undefined> {
    const result = await this.fetch({ ...q, offset: 0, limit: 1 }, runner);
    return result.items[0];
  }

  async fetchOneById(
    id: string,
    runner?: Contact
  ): Promise<GetData | undefined> {
    const query = {
      rules: {
        condition: "AND",
        rules: [{ field: this.modelIdField, operator: "equal", value: [id] }]
      }
    } as Query;

    return await this.fetchOne(query, runner);
  }
}

export namespace Transformer {
  export class Query extends GetPaginatedQuery {}
}
