import {
  Filters,
  InvalidRule,
  Paginated,
  PaginatedQuery,
  RoleType,
  validateRuleGroup
} from "@beabee/beabee-common";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "@core/database";

import NotFoundError from "@api/errors/NotFoundError";
import InvalidRuleError from "@api/errors/InvalidRuleError";
import UnauthorizedError from "@api/errors/UnauthorizedError";
import { convertRulesToWhereClause } from "@api/utils/rules";

import Contact from "@models/Contact";

import { FilterHandlers } from "@type/filter-handlers";

export abstract class BaseTransformer<
  Model extends ObjectLiteral,
  GetDto,
  FilterName extends string = never,
  GetDtoOpts = unknown,
  Query extends GetDtoOpts & PaginatedQuery = GetDtoOpts & PaginatedQuery
> {
  protected abstract model: { new (): Model };
  protected modelIdField = "id";

  protected abstract filters: Filters<FilterName>;
  protected filterHandlers: FilterHandlers<FilterName> = {};

  protected allowedRoles: RoleType[] | undefined;

  abstract convert(model: Model, opts: GetDtoOpts, caller?: Contact): GetDto;

  protected transformQuery(query: Query, caller: Contact | undefined): Query {
    return query;
  }

  protected transformFilters(
    query: Query,
    caller: Contact | undefined
  ): [Partial<Filters<FilterName>>, FilterHandlers<FilterName>] {
    return [{}, {}];
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Model>,
    fieldPrefix: string,
    query: Query,
    caller: Contact | undefined
  ): void {}

  protected async modifyResult(
    result: Paginated<Model>,
    query: Query,
    caller: Contact | undefined
  ): Promise<void> {}

  protected preFetch(
    caller: Contact | undefined,
    query: Query
  ): [Filters<FilterName>, FilterHandlers<FilterName>] {
    if (
      this.allowedRoles &&
      !this.allowedRoles.some((r) => caller?.hasRole(r))
    ) {
      throw new UnauthorizedError();
    }

    const [filters, filterHandlers] = this.transformFilters(query, caller);

    return [
      { ...this.filters, ...filters },
      { ...this.filterHandlers, ...filterHandlers }
    ];
  }

  async fetch(
    caller: Contact | undefined,
    query: Query
  ): Promise<Paginated<GetDto>> {
    const [filters, filterHandlers] = this.preFetch(caller, query);

    query = this.transformQuery(query, caller);

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    try {
      const ruleGroup = query.rules && validateRuleGroup(filters, query.rules);

      const qb = createQueryBuilder(this.model, "item").offset(offset);

      if (limit !== -1) {
        qb.limit(limit);
      }

      if (ruleGroup) {
        qb.where(
          ...convertRulesToWhereClause(
            ruleGroup,
            caller,
            filterHandlers,
            "item."
          )
        );
      }

      if (query.sort) {
        qb.orderBy(`item."${query.sort}"`, query.order || "ASC", "NULLS LAST");
      }

      this.modifyQueryBuilder(qb, "item.", query, caller);

      const [items, total] = await qb.getManyAndCount();

      const result = {
        total,
        offset,
        count: items.length,
        items
      };

      await this.modifyResult(result, query, caller);

      return {
        ...result,
        items: result.items.map((item) => this.convert(item, query, caller))
      };
    } catch (err) {
      throw err instanceof InvalidRule
        ? new InvalidRuleError(err.rule, err.message)
        : err;
    }
  }

  async fetchOne(
    caller: Contact | undefined,
    query: Query
  ): Promise<GetDto | undefined> {
    const result = await this.fetch(caller, { ...query, limit: 1 });
    return result.items[0];
  }

  async fetchOneById(
    caller: Contact | undefined,
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

    return await this.fetchOne(caller, query);
  }

  async fetchOneByIdOrFail(
    caller: Contact | undefined,
    id: string,
    opts?: GetDtoOpts
  ): Promise<GetDto> {
    const result = await this.fetchOneById(caller, id, opts);
    if (!result) {
      throw new NotFoundError();
    }
    return result;
  }
}
