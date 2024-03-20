import { RuleGroup } from "@beabee/beabee-common";
import express, { Request } from "express";
import queryString from "query-string";

import { getRepository } from "#core/database";
import { isAdmin } from "#core/middleware";
import { userToAuth, wrapAsync } from "#core/utils";

import OptionsService from "#core/services/OptionsService";
import SegmentService from "#core/services/SegmentService";

import ContactTransformer from "#api/transformers/ContactTransformer";

import Project from "#models/Project";
import Contact from "#models/Contact";

import { GetContactWith } from "#enums/get-contact-with";

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

function getAvailableTags() {
  return Promise.resolve(OptionsService.getList("available-tags"));
}

type SortOption = {
  label: string;
  sort: string;
};

const sortOptions: Record<string, SortOption> = {
  lastname: {
    label: "Last name",
    sort: "lastname"
  },
  firstname: {
    label: "First name",
    sort: "firstname"
  },
  email: {
    label: "Email",
    sort: "email"
  },
  joined: {
    label: "Joined",
    sort: "joined"
  }
} as const;

function convertBasicSearch(query: Request["query"]): RuleGroup | undefined {
  const search: RuleGroup = {
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

// Convert legacy app group queries to clean RuleGroups
export function cleanRuleGroup(group: RuleGroup): RuleGroup {
  return {
    condition: group.condition,
    rules: group.rules.map((rule) =>
      "condition" in rule
        ? cleanRuleGroup(rule)
        : {
          field: rule.field,
          operator: rule.operator,
          value: Array.isArray(rule.value) ? rule.value : [rule.value]
        }
    )
  };
}

function getSearchRuleGroup(
  query: Request["query"],
  searchType?: string
): RuleGroup | undefined {
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

    const auth = userToAuth(req.user!);

    const totalMembers = await getRepository(Contact).count();
    const segments = await SegmentService.getSegmentsWithCount(auth);
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

    const sort = (query.sort as string) || "lastname_ASC";
    const [sortId, sortDir] = sort.split("_");

    const result = await ContactTransformer.fetch(auth, {
      offset: limit * (page - 1),
      limit,
      sort: sortOptions[sortId].sort,
      order: sortDir as "ASC" | "DESC",
      with: [GetContactWith.Profile, GetContactWith.Roles],
      ...(searchRuleGroup && { rules: searchRuleGroup })
    });

    const pages = [...Array(Math.ceil(result.total / limit))].map(
      (v, page) => ({
        number: page + 1,
        path: "/members?" + queryString.stringify({ ...query, page: page + 1 })
      })
    );

    const next = page + 1 <= pages.length ? pages[page] : null;
    const prev = page - 1 > 0 ? pages[page - 2] : null;

    const pagination = {
      pages,
      page,
      prev,
      next,
      start: (page - 1) * limit + 1,
      end: Math.min(result.total, page * limit),
      total: pages.length
    };

    const addToProject =
      query.addToProject &&
      (await getRepository(Project).findOneBy({
        id: query.addToProject as string
      }));

    res.render("index", {
      availableTags,
      members: result.items,
      pagination,
      total: result.total,
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
