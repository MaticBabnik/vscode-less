'use strict';

import * as path from 'path';

import { TextDocument, Files } from 'vscode-languageserver';
import { getLESSLanguageService } from 'vscode-css-languageservice';

import { INode } from '../types/nodes';
import { IDocument, ISymbols } from '../types/symbols';
import { ISettings } from '../types/settings';

import { findSymbols, findSymbolsAtOffset } from '../parser/symbols';
import { getNodeAtOffset } from '../utils/ast';

// Less Language Service
const ls = getLESSLanguageService();

ls.configure({
	lint: false,
	validate: false
});

/**
 * Returns all Symbols in a single document.
 */
export function parseDocument(document: TextDocument, offset: number = null, settings: ISettings): IDocument {
	let symbols: ISymbols;
	try {
		symbols = findSymbols(document.getText());
	} catch (err) {
		if (settings.showErrors) {
			throw err;
		}

		symbols = {
			variables: [],
			mixins: [],
			imports: []
		};
	}

	// Set path for document in Symbols collection
	symbols.document = Files.uriToFilePath(document.uri) || document.uri;

	// Get `<reference *> comments from document
	const references = document.getText().match(/\/\/\s*<reference\s*path=["'](.*)['"]\s*\/?>/g);
	if (references) {
		references.forEach((x) => {
			const filepath = /\/\/\s*<reference\s*path=["'](.*)['"]\s*\/?>/.exec(x)[1];
			symbols.imports.push({
				css: /css$/.test(filepath),
				dynamic: /@{}\*/.test(filepath),
				filepath,
				modes: [],
				reference: true
			});
		});
	}

	let ast: INode = null;
	if (offset) {
		ast = <INode>ls.parseStylesheet(document);

		const scopedSymbols = findSymbolsAtOffset(ast, offset);

		symbols.variables = symbols.variables.concat(scopedSymbols.variables);
		symbols.mixins = symbols.mixins.concat(scopedSymbols.mixins);
	}

	symbols.imports = symbols.imports.map((x) => {
		x.filepath = path.join(path.dirname(symbols.document), x.filepath);
		if (!x.css && !/\.less$/.test(x.filepath)) {
			x.filepath += '.less';
		}
		return x;
	});

	symbols.variables = symbols.variables.map((x) => {
		x.position = document.positionAt(x.offset);
		return x;
	});

	symbols.mixins = symbols.mixins.map((x) => {
		x.position = document.positionAt(x.offset);
		return x;
	});

	return {
		symbols,
		node: offset ? getNodeAtOffset(ast, offset) : null
	};
}
