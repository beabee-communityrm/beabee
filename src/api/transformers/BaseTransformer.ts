import {
  Filters,
  InvalidRule,
  PaginatedQuery,
  RoleType,
  validateRuleGroup
} from "@beabee/beabee-common";
import { plainToInstance } from "class-transformer";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "@core/database";

import { PaginatedDto } from "@api/dto/PaginatedDto";
import NotFoundError from "@api/errors/NotFoundError";
import InvalidRuleError from "@api/errors/InvalidRuleError";
import UnauthorizedError from "@api/errors/UnauthorizedError";
import { convertRulesToWhereClause } from "@api/utils/rules";

import Contact from "@models/Contact";

import { AuthInfo } from "@type/auth-info";
import { FilterHandlers } from "@type/filter-handlers";

/**
 * Base transformer for querying and converting models to DTOs
 */
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

  abstract convert(model: Model, opts: GetDtoOpts, auth?: AuthInfo): GetDto;

  /**
   * Transform the query before the results are fetched.
   *
   * This is typically used to add extra rules that limit the results returned
   * based on the query or caller.
   *
   * @param query The query
   * @param caller The contact who is requesting the results
   * @returns A new query
   */
  protected transformQuery<T extends Query>(
    query: T,
    auth: AuthInfo | undefined
  ): T {
    return query;
  }

  /**
   * Transform the filters before the results are fetched.
   *
   * This can be used to add extra filters and handlers depending on the query
   *
   * @param query The query
   * @param caller The contact who is requesting the results
   * @returns New filters and filter handlers
   */
  protected transformFilters(
    query: Query,
    auth: AuthInfo | undefined
  ): [Partial<Filters<FilterName>>, FilterHandlers<FilterName>] {
    return [{}, {}];
  }

  /**
   * Modify the query builder before the results are fetched.
   *
   * Use this method to add extra joins, where clauses, etc. to the query builder
   * which load any additional data needed for the results. Typically used to
   * add joins to related entities.
   *
   * @param qb The query builder
   * @param fieldPrefix The prefix to use for fields
   * @param query The query
   * @param caller The contact who is requesting the results
   */
  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Model>,
    fieldPrefix: string,
    query: Query,
    auth: AuthInfo | undefined
  ): void {}

  /**
   * Modify the items after they are fetched.
   *
   * Use this method to add extra data to the items. Typically used to add
   * related entities to the items, or load additional data or relations which
   *
   * @param items The list of items
   * @param query The query
   * @param caller The contact who is requesting the results
   */
  protected async modifyItems(
    items: Model[],
    query: Query,
    auth: AuthInfo | undefined
  ): Promise<void> {}

  /**
   * Check the caller is allowed to request te resource and prepare the query,
   * filters and filter handlers.
   *
   * @param query The query
   * @param auth The contact who is requesting the results
   */
  protected preFetch<T extends Query>(
    query: T,
    auth: AuthInfo | undefined
  ): [T, Filters<FilterName>, FilterHandlers<FilterName>] {
    if (
      this.allowedRoles &&
      !this.allowedRoles.some((r) => auth?.roles.includes(r))
    ) {
      throw new UnauthorizedError();
    }

    const [filters, filterHandlers] = this.transformFilters(query, auth);

    return [
      this.transformQuery(query, auth),
      { ...this.filters, ...filters },
      { ...this.filterHandlers, ...filterHandlers }
    ];
  }

  /**
   * Fetch a list of items
   *
   * @param auth The contact who is requesting the results
   * @param query_ The query
   * @returns A list of items that match the query
   */
  async fetch(
    auth: AuthInfo | undefined,
    query_: Query
  ): Promise<PaginatedDto<GetDto>> {
    const [query, filters, filterHandlers] = this.preFetch(query_, auth);

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
            auth?.entity instanceof Contact ? auth.entity : undefined,
            filterHandlers,
            "item."
          )
        );
      }

      if (query.sort) {
        qb.orderBy(`item."${query.sort}"`, query.order || "ASC", "NULLS LAST");
      }

      this.modifyQueryBuilder(qb, "item.", query, auth);

      const [items, total] = await qb.getManyAndCount();

      await this.modifyItems(items, query, auth);

      return plainToInstance(PaginatedDto<GetDto>, {
        total,
        offset,
        count: items.length,
        items: items.map((item) => this.convert(item, query, auth))
      });
    } catch (err) {
      throw err instanceof InvalidRule
        ? new InvalidRuleError(err.rule, err.message)
        : err;
    }
  }

  /**
   *  Fetch a single item
   *
   * @param auth The contact who is requesting the results
   * @param query The query
   * @returns A single item or undefined if not found
   */
  async fetchOne(
    auth: AuthInfo | undefined,
    query: Query
  ): Promise<GetDto | undefined> {
    const result = await this.fetch(auth, { ...query, limit: 1 });
    return result.items[0];
  }

  /**
   * Fetch a single item by it's primary key
   *
   * @param caller The contact who is requesting the results
   * @param id The primary key of the item
   * @param opts Additional options to pass to the query
   * @returns A single item or undefined if not found
   */
  async fetchOneById(
    auth: AuthInfo | undefined,
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

    return await this.fetchOne(auth, query);
  }

  /**
   * Fetch a single item by it's primary key or throw an error if not found
   *
   * @param auth  The contact who is requesting the results
   * @param id  The primary key of the item
   * @param opts Additional options to pass to the query
   * @returns A single item
   */
  async fetchOneByIdOrFail(
    auth: AuthInfo | undefined,
    id: string,
    opts?: GetDtoOpts
  ): Promise<GetDto> {
    const result = await this.fetchOneById(auth, id, opts);
    if (!result) {
      throw new NotFoundError();
    }
    return result;
  }

  /**
   * Fetch the number of items that match the query
   *
   * @param auth The contact who is requesting the results
   * @param query The query
   * @returns The number of items that match the query
   */
  async count(auth: AuthInfo | undefined, query: Query): Promise<number> {
    return (await this.fetch(auth, { ...query, limit: 0 })).total;
  }
}
