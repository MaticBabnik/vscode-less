'use strict';

import {
	SymbolInformation,
	SymbolKind
} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import { ICache } from '../services/cache';

import { getSymbolsCollection } from '../utils/symbols';

/**
 * All Symbol Definitions in Folder :)
 */
export function searchWorkspaceSymbol(query: string, cache: ICache, root: string): SymbolInformation[] {
	const workspaceSymbols: SymbolInformation[] = [];

	getSymbolsCollection(cache).forEach((symbols) => {
		const documentUri = Uri.file(symbols.document);
		if (!documentUri.fsPath.includes(root)) {
			return;
		}

		['variables', 'mixins'].forEach((type) => {
			const kind = type === 'variables' ? SymbolKind.Variable : SymbolKind.Function;

			symbols[type].forEach((symbol) => {
				if (!symbol.name.includes(query)) {
					return;
				}

				workspaceSymbols.push({
					name: symbol.name,
					kind,
					location: {
						uri: documentUri.toString(),
						range: {
							start: symbol.position,
							end: {
								line: symbol.position.line,
								character: symbol.position.character + symbol.name.length
							}
						}
					}
				});
			});
		});
	});

	return workspaceSymbols;
}
