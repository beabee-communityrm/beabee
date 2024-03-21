import express from "express";
import Papa from "papaparse";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";

import { getRepository } from "#core/database";
import { hasNewModel, hasSchema, isAdmin } from "#core/middleware";
import { wrapAsync } from "#core/utils";
import { Param, parseParams } from "#core/utils/params";

import Export, { ExportTypeId } from "#models/Export";
import ExportItem from "#models/ExportItem";

import { createSchema, updateSchema } from "./schemas.json";

import ExportTypes from "./exports";

export interface ExportType<T extends ObjectLiteral> {
  exportName: string;
  itemName: string;
  itemStatuses: string[];
  idColumn: string;
  getParams?(): Promise<Param[]>;
  getQuery(ex: Export): SelectQueryBuilder<T>;
  getExport(ex: Export, items: T[]): Promise<Record<string, unknown>[]>;
}

interface CreateSchema {
  type: ExportTypeId;
  description: string;
  params?: Record<string, string>;
}

interface AddItemSchema {
  action: "add";
}

interface UpdateItemsSchema {
  action: "update";
  oldStatus: string;
  newStatus: string;
}

interface ExportSchema {
  action: "export";
  status?: string;
}

interface DeleteSchema {
  action: "delete";
}

type UpdateSchema =
  | AddItemSchema
  | UpdateItemsSchema
  | ExportSchema
  | DeleteSchema;

async function schemaToExport(data: CreateSchema): Promise<Export> {
  const exportDetails = new Export();
  exportDetails.type = data.type;
  exportDetails.description = data.description;
  exportDetails.params = data.params
    ? await parseParams(new ExportTypes[data.type](), data.params)
    : null;
  return exportDetails;
}

const app = express();

app.set("views", __dirname + "/views");

app.use(isAdmin);

app.get(
  "/",
  wrapAsync(async function (req, res) {
    const exports = await getRepository(Export).find();

    const exportsByType = Object.keys(ExportTypes).map((type) => ({
      exportName: new ExportTypes[type as ExportTypeId]().exportName,
      exports: exports.filter((e) => e.type === type)
    }));

    const exportTypesWithParams = [];
    for (const type in ExportTypes) {
      const exportType = new ExportTypes[type as ExportTypeId]();
      exportType.type = type;
      exportType.params = await exportType.getParams();
      exportTypesWithParams.push(exportType);
    }

    res.render("index", { exportsByType, exportTypesWithParams });
  })
);

app.post(
  "/",
  hasSchema(createSchema).orFlash,
  wrapAsync(async function (req, res) {
    const exportDetails = await getRepository(Export).save(
      await schemaToExport(req.body)
    );
    req.flash("success", "exports-created");
    res.redirect("/tools/exports/" + exportDetails.id);
  })
);

app.get(
  "/:id",
  hasNewModel(Export, "id"),
  wrapAsync(async function (req, res) {
    const exportDetails = req.model as Export;
    const exportType = new ExportTypes[exportDetails.type](exportDetails);

    const exportItems = await getRepository(ExportItem).find({
      where: { exportId: exportDetails.id }
    });
    const newItemIds = await exportType.getNewItemIds();

    const exportItemsByStatus = exportType.itemStatuses.map((status) => ({
      name: status,
      items: exportItems.filter((item) => item.status === status)
    }));

    res.render("export", {
      exportDetails,
      exportType,
      exportItems,
      exportItemsByStatus,
      newItemCount: newItemIds.length
    });
  })
);

app.get(
  "/:id/items/:status",
  hasNewModel(Export, "id"),
  wrapAsync(async (req, res) => {
    const exportDetails = req.model as Export;
    const exportType = new ExportTypes[exportDetails.type](exportDetails);

    const items =
      req.params.status === "new"
        ? await exportType.getNewItems()
        : await exportType.getItems(req.params.status);

    const exportData = await exportType.getExport(items as any);

    const fields =
      "fields" in exportData ? exportData.fields : Object.keys(exportData[0]);
    const data =
      "data" in exportData
        ? exportData.data
        : exportData.map((row) => fields.map((field) => row[field]));

    res.render("items", {
      fields,
      data,
      exportDetails,
      status: req.params.status
    });
  })
);

app.post(
  "/:id",
  [hasSchema(updateSchema).orFlash, hasNewModel(Export, "id")],
  wrapAsync(async function (req, res) {
    const data = req.body as UpdateSchema;
    const exportDetails = req.model as Export;
    const exportType = new ExportTypes[exportDetails.type](exportDetails);

    if (data.action === "add") {
      const newItemIds = await exportType.getNewItemIds();
      const newExportItems = newItemIds.map((id) => ({
        itemId: id,
        export: exportDetails,
        status: exportType.itemStatuses[0]
      }));
      await getRepository(ExportItem).insert(newExportItems);

      req.flash("success", "exports-added");
      res.redirect("/tools/exports/" + exportDetails.id);
    } else if (data.action === "update") {
      await getRepository(ExportItem).update(
        { exportId: exportDetails.id, status: data.oldStatus },
        { status: data.newStatus }
      );

      req.flash("success", "exports-updated");
      res.redirect("/tools/exports/" + exportDetails.id);
    } else if (data.action === "export") {
      const items = await exportType.getItems(data.status);

      const exportName = `export-${
        exportDetails.description
      }_${new Date().toISOString()}.csv`;
      const exportData = await exportType.getExport(items as any);

      res.attachment(exportName).send(Papa.unparse(exportData as any)); // TODO: fix
    } else if (data.action === "delete") {
      await getRepository(ExportItem).delete({ exportId: exportDetails.id });
      await getRepository(Export).delete(exportDetails.id);
      req.flash("success", "exports-deleted");
      res.redirect("/tools/exports");
    }
  })
);

export default app;
