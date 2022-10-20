import express, { Request } from "express";
import queryString from "query-string";
import { getRepository } from "typeorm";

import { isAdmin } from "@core/middleware";
import { wrapAsync } from "@core/utils";
import { buildQuery } from "@core/utils/rules";

import OptionsService from "@core/services/OptionsService";
import SegmentService from "@core/services/SegmentService";

import Project from "@models/Project";
import Member from "@models/Member";
import { RuleGroup } from "@core/utils/newRules";
import { ContactFilterName } from "@beabee/beabee-common";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

function getAvailableTags() {
  return Promise.resolve(OptionsService.getList("available-tags"));
}

type SortOption = {
  label: string;
  order: readonly string[];
};

const sortOptions: Record<string, SortOption> = {
  lf: {
    label: "Last name, first name",
    order: ["lastname_n", "firstname_n", "email"]
  },
  fl: {
    label: "First name, last name",
    order: ["firstname_n", "lastname_n", "email"]
  },
  e: {
    label: "Email",
    order: ["email", "lastname_n", "firstname_n"]
  },
  j: {
    label: "Joined",
    order: ["joined", "lastname_n", "firstname_n"]
  }
} as const;

type SortKey = keyof typeof sortOptions;

function convertBasicSearch(
  query: Request["query"]
): RuleGroup<ContactFilterName> | undefined {
  const search: RuleGroup<ContactFilterName> = {
    condition: "AND",
    rules: []
  };

  for (const field of ["firstname", "lastname", "email"] as const) {
    if (query[field]) {
      search.rules.push({
        field,
        operator: "contains",
        value: [query[field] as string]
      });
    }
  }
  if (query.tag) {
    search.rules.push({
      field: "tags",
      operator: "contains",
      value: [query.tag as string]
    });
  }

  return search.rules.length > 0 ? search : undefined;
}

// Removes any extra properties on the group
function cleanRuleGroup(
  group: RuleGroup<ContactFilterName>
): RuleGroup<ContactFilterName> {
  return {
    condition: group.condition,
    rules: group.rules.map((rule) =>
      "condition" in rule
        ? cleanRuleGroup(rule)
        : {
            field: rule.field,
            operator: rule.operator,
            value: rule.value
          }
    )
  };
}

function getSearchRuleGroup(
  query: Request["query"],
  searchType?: string
): RuleGroup<ContactFilterName> | undefined {
  return (searchType || query.type) === "basic"
    ? convertBasicSearch(query)
    : typeof query.rules === "string"
    ? cleanRuleGroup(JSON.parse(query.rules))
    : undefined;
}

app.get(
  "/",
  wrapAsync(async (req, res) => {
    const { query } = req;
    const availableTags = await getAvailableTags();

    const totalMembers = await getRepository(Member).count();
    const segments = await SegmentService.getSegmentsWithCount();
    const activeSegment = query.segment
      ? segments.find((s) => s.id === query.segment)
      : undefined;

    const searchType =
      (query.type as string) || (activeSegment ? "advanced" : "basic");
    const searchRuleGroup =
      getSearchRuleGroup(query, searchType) ||
      (activeSegment && activeSegment.ruleGroup);

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 50;

    const sort = (query.sort as string) || "lf_ASC";
    const [sortId, sortDir] = sort.split("_");

    const orderBy = Object.assign(
      {},
      ...sortOptions[sortId as SortKey].order.map((col) => ({
        [col]: sortDir
      }))
    );

    const [members, total] = await buildQuery(searchRuleGroup)
      .addSelect("NULLIF(lastname, '')", "lastname_n")
      .addSelect("NULLIF(firstname, '')", "firstname_n")
      .orderBy(orderBy)
      .offset(limit * (page - 1))
      .limit(limit)
      .getManyAndCount();

    const pages = [...Array(Math.ceil(total / limit))].map((v, page) => ({
      number: page + 1,
      path: "/members?" + queryString.stringify({ ...query, page: page + 1 })
    }));

    const next = page + 1 <= pages.length ? pages[page] : null;
    const prev = page - 1 > 0 ? pages[page - 2] : null;

    const pagination = {
      pages,
      page,
      prev,
      next,
      start: (page - 1) * limit + 1,
      end: Math.min(total, page * limit),
      total: pages.length
    };

    const addToProject =
      query.addToProject &&
      (await getRepository(Project).findOne(query.addToProject as string));

    res.render("index", {
      availableTags,
      members,
      pagination,
      total,
      searchQuery: query,
      searchType,
      searchRuleGroup,
      sortOptions,
      totalMembers,
      segments,
      activeSegment,
      addToProject
    });
  })
);

app.post(
  "/",
  wrapAsync(async (req, res) => {
    const searchRuleGroup = getSearchRuleGroup(req.query);
    if (searchRuleGroup) {
      if (req.body.action === "save-segment") {
        const segment = await SegmentService.createSegment(
          "Untitled segment",
          searchRuleGroup
        );
        res.redirect("/members/?segment=" + segment.id);
      } else if (req.body.action === "update-segment" && req.query.segment) {
        const segmentId = req.query.segment as string;
        await SegmentService.updateSegment(segmentId, {
          ruleGroup: searchRuleGroup
        });
        res.redirect("/members/?segment=" + segmentId);
      } else {
        res.redirect(req.originalUrl);
      }
    } else {
      req.flash("error", "segment-no-rule-group");
      res.redirect(req.originalUrl);
    }
  })
);

export default app;
