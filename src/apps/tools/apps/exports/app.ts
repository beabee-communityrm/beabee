import express from 'express';
import Papa from 'papaparse';
import { getRepository } from 'typeorm';

import auth from  '@core/authentication' ;
import { hasNewModel, hasSchema } from  '@core/middleware' ;
import { wrapAsync } from  '@core/utils' ;
import { loadParams, parseParams } from '@core/utils/params';

import Export, { ExportTypeId } from '@models/Export';
import ExportItem from '@models/ExportItem';

import { createSchema, updateSchema } from './schemas.json';
import exportTypes from './exports';

const exportTypesWithTypeId = Object.entries(exportTypes).map(([type, exportType]) => ({
	...exportType, type
}));

interface CreateSchema {
	type: ExportTypeId,
	description: string,
	params?: Record<string, string>
}

interface AddItemSchema {
	action: 'add'
}

interface UpdateItemsSchema {
	action: 'update'
	oldStatus: string
	newStatus: string
}

interface ExportSchema {
	action: 'export'
	status?: string
}

interface DeleteSchema {
	action: 'delete'
}

type UpdateSchema = AddItemSchema|UpdateItemsSchema|ExportSchema|DeleteSchema;

async function schemaToExport(data: CreateSchema): Promise<Export> {
	const exportDetails = new Export();
	exportDetails.type = data.type;
	exportDetails.description = data.description;
	exportDetails.params = data.params ? await parseParams(exportTypes[data.type], data.params) : null;
	return exportDetails;
}

async function getExportItems(exportDetails: Export, full=false) {
	const exportType = exportTypes[exportDetails.type];

	const exportItems = await getRepository(ExportItem).find({
		where: {export: exportDetails}
	});

	const newItems = await exportType.collection.find({
		...await exportType.getQuery(exportDetails),
		_id: {$not: {$in: exportItems.map(ei => ei.itemId)}}
	}, (full ? null : 'id') as any);

	return {exportItems, newItems};
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.get( '/', wrapAsync( async function( req, res ) {
	const exports = await getRepository(Export).find();

	const exportsByType = Object.keys(exportTypes).map(type => ({
		name: exportTypes[type as ExportTypeId].name,
		exports: exports.filter(e => e.type === type)
	}));

	const exportTypesWithParams = await loadParams(exportTypesWithTypeId);

	res.render('index', {exportsByType, exportTypesWithParams});
} ) );

app.post( '/', hasSchema(createSchema).orFlash, wrapAsync( async function( req, res ) {
	const exportDetails = await getRepository(Export).save(await schemaToExport(req.body));
	req.flash('success', 'exports-created');
	res.redirect('/tools/exports/' + exportDetails.id);
} ) );

app.get( '/:id', hasNewModel(Export, 'id'), wrapAsync( async function( req, res ) {
	const exportDetails = req.model as Export;
	const exportType = exportTypes[exportDetails.type];

	const {exportItems, newItems} = await getExportItems(exportDetails);

	const exportItemsByStatus = exportType.statuses.map(status => ({
		name: status,
		items: exportItems.filter(item => item.status === status)
	}));

	res.render('export', {
		exportDetails,
		exportType,
		exportItems,
		exportItemsByStatus,
		newItems
	});
} ) );

app.get('/:id/items/:status', hasNewModel(Export, 'id'), wrapAsync(async (req, res) => {
	const exportDetails = req.model as Export;
	const exportType = exportTypes[exportDetails.type];

	const {newItems, exportItems} = await getExportItems(exportDetails, true);

	const items = req.params.status === 'new' ?
		newItems :
		await exportType.collection.find({
			_id: {$in: exportItems.filter(ei => ei.status === req.params.status).map(ei => ei.itemId)}
		});

	res.render('items', {
		items: await exportType.getExport(items, exportDetails),
		exportDetails,
		status: req.params.status
	});
}));

app.post( '/:id', [
	hasSchema(updateSchema).orFlash,
	hasNewModel(Export, 'id')
], wrapAsync( async function( req, res ) {
	const data = req.body as UpdateSchema;
	const exportDetails = req.model as Export;
	const exportType = exportTypes[exportDetails.type];

	if (data.action === 'add') {
		const {newItems} = await getExportItems(exportDetails);
		const newExportItems = (newItems as any).map((item: {id: string}) => ({
			itemId: item.id,
			export: exportDetails,
			status: exportType.statuses[0]
		}));
		await getRepository(ExportItem).insert(newExportItems);

		req.flash('success', 'exports-added');
		res.redirect('/tools/exports/' + exportDetails.id);

	} else if (data.action === 'update') {
		await getRepository(ExportItem).update({
			export: exportDetails, status: data.oldStatus
		}, {status: data.newStatus});

		req.flash('success', 'exports-updated');
		res.redirect('/tools/exports/' + exportDetails.id);

	} else if (data.action === 'export') {
		const exportItems = await getRepository(ExportItem).find({
			where: {export: exportDetails, ...(data.status && {status: data.status})}
		});

		const items = await exportType.collection.find({_id: {$in: exportItems.map(ei => ei.itemId)}});

		const exportName = `export-${exportDetails.description}_${new Date().toISOString()}.csv`;
		const exportData = await exportType.getExport(items, exportDetails);

		res.attachment(exportName).send(Papa.unparse(exportData));

	} else if (data.action === 'delete') {
		await getRepository(ExportItem).delete({export: exportDetails});
		await getRepository(Export).delete(exportDetails.id);
		req.flash('success', 'exports-deleted');
		res.redirect('/tools/exports');
	}
} ) );

export default app;
