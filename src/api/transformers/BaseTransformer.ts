import {
  Filters,
  Paginated,
  PaginatedQuery,
  RoleType
} from "@beabee/beabee-common";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";

import { FieldHandlers, fetchPaginated } from "@api/data/PaginatedData";

import UnauthorizedError from "@api/errors/UnauthorizedError";
import NotFoundError from "@api/errors/NotFoundError";

import Contact from "@models/Contact";

export abstract class BaseTransformer<
  Model extends ObjectLiteral,
  GetDto,
  FilterName extends string,
  GetDtoOpts = unknown,
  Query extends GetDtoOpts & PaginatedQuery = GetDtoOpts & PaginatedQuery
> {
  abstract model: { new (): Model };
  abstract filters: Filters<FilterName>;

  fieldHandlers: FieldHandlers<FilterName> | undefined;
  modelIdField = "id";
  allowedRoles: RoleType[] | undefined;

  abstract convert(model: Model, opts: GetDtoOpts, runner?: Contact): GetDto;

  protected transformQuery(query: Query, runner: Contact | undefined): Query {
    return query;
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Model>,
    fieldPrefix: string,
    opts: GetDtoOpts
  ): void {}

  protected async modifyResult(
    result: Paginated<Model>,
    query: Query,
    runner: Contact | undefined
  ): Promise<void> {}

  async fetch(
    runner: Contact | undefined,
    query: Query
  ): Promise<Paginated<GetDto>> {
    if (
      this.allowedRoles &&
      !this.allowedRoles.some((r) => runner?.hasRole(r))
    ) {
      throw new UnauthorizedError();
    }

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

  async fetchOne(
    runner: Contact | undefined,
    query: Query
  ): Promise<GetDto | undefined> {
    const result = await this.fetch(runner, { ...query, limit: 1 });
    return result.items[0];
  }

  async fetchOneById(
    runner: Contact | undefined,
    id: string,
    opts?: GetDtoOpts
  ): Promise<GetDto | undefined> {
    const query = {
      ...opts,
      rules: {
        condition: "AND",
        rules: [{ field: this.modelIdField, operator: "equal", value: [id] }]
      }
    } as Query;

    return await this.fetchOne(runner, query);
  }

  async fetchOneByIdOrFail(
    runner: Contact | undefined,
    id: string,
    opts?: GetDtoOpts
  ): Promise<GetDto> {
    const result = await this.fetchOneById(runner, id, opts);
    if (!result) {
      throw new NotFoundError();
    }
    return result;
  }
}
