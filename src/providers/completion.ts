'use strict';

import {
	CompletionList,
	CompletionItemKind,
	TextDocument,
	Files
} from 'vscode-languageserver';

import { INode, NodeType } from '../types/nodes';
import { ICache } from '../services/cache';
import { IMixin } from '../types/symbols';
import { ISettings } from '../types/settings';

import { parseDocument } from '../services/parser';
import { getSymbolsCollection } from '../utils/symbols';
import { getCurrentDocumentImportPaths, getDocumentPath } from '../utils/document';
import { getCurrentWord, getLimitedString, getTextBeforePosition } from '../utils/string';

/**
 * Return Mixin as string.
 */
function makeMixinDocumentation(symbol: IMixin): string {
	const args = symbol.parameters.map((item) => `${item.name}: ${item.value}`).join(', ');
	return `${symbol.name}(${args}) {\u2026}`;
}

/**
 * Skip suggestions for parent Mixin inside Mixins.
 */
function mixinSuggestionsFilter(mixin: IMixin, node: INode): boolean {
	if (!node) {
		return false;
	}

	while (node.type !== NodeType.Stylesheet) {
		if (node.type === NodeType.MixinDeclaration) {
			const identifier = node.getIdentifier();
			if (identifier && identifier.getText() === mixin.name) {
				return true;
			}
		}
		node = node.getParent();
	}

	return false;
}

/**
 * Do Completion :)
 */
export function doCompletion(document: TextDocument, offset: number, settings: ISettings, cache: ICache): CompletionList {
	const completions = CompletionList.create([], false);

	const documentPath = Files.uriToFilePath(document.uri) || document.uri;
	if (!documentPath) {
		return null;
	}

	const resource = parseDocument(document, offset, settings);

	// Update Cache for current document
	cache.set(documentPath, resource.symbols);

	const symbolsList = getSymbolsCollection(cache);
	const documentImports = getCurrentDocumentImportPaths(symbolsList, documentPath);
	const currentWord = getCurrentWord(document.getText(), offset);
	const textBeforeWord = getTextBeforePosition(document.getText(), offset);

	// is .@{NAME}-test { ... }
	const isInterpolationVariable = currentWord.indexOf('@{') !== -1;
	// Is property value
	const isPropertyValue = /.*:\s*/.test(textBeforeWord);

	// Bad idea: Drop suggestions inside `//` and `/* */` comments
	if (/^(\/(\/|\*)|\*)/.test(textBeforeWord.trim())) {
		return completions;
	}

	if (settings.suggestVariables && (currentWord.startsWith('@') || isInterpolationVariable || isPropertyValue)) {
		symbolsList.forEach((symbols) => {
			const fsPath = getDocumentPath(documentPath, symbols.document);
			const isImplicitlyImport = symbols.document !== documentPath && documentImports.indexOf(symbols.document) === -1;

			symbols.variables.forEach((variable) => {
				// Drop Variable if its value is RuleSet in interpolation
				// .test-@{|cursor}
				if (isInterpolationVariable && variable.value && variable.value.indexOf('{') !== -1) {
					return;
				}

				// Add 'implicitly' prefix for Path if the file imported implicitly
				let detailPath = fsPath;
				if (isImplicitlyImport && settings.implicitlyLabel) {
					detailPath = settings.implicitlyLabel + ' ' + detailPath;
				}

				// Add 'argument from MIXIN_NAME' suffix if Variable is Mixin argument
				let detailText = detailPath;
				if (variable.mixin) {
					detailText = `argument from ${variable.mixin}, ${detailText}`;
				}

				completions.items.push({
					// If variable interpolation, then remove the @ character from label
					label: isInterpolationVariable ? variable.name.substr(1) : variable.name,
					kind: CompletionItemKind.Variable,
					detail: detailText,
					documentation: getLimitedString(variable.value)
				});
			});
		});
	} else if (settings.suggestMixins && (currentWord.startsWith('.') || currentWord.startsWith('#'))) {
		symbolsList.forEach((symbols) => {
			const fsPath = getDocumentPath(documentPath, symbols.document);
			const isImplicitlyImport = symbols.document !== documentPath && documentImports.indexOf(symbols.document) === -1;

			symbols.mixins.forEach((mixin) => {
				if (mixinSuggestionsFilter(mixin, resource.ast)) {
					return;
				}

				// Add 'implicitly' prefix for Path if the file imported implicitly
				let detailPath = fsPath;
				if (isImplicitlyImport && settings.implicitlyLabel) {
					detailPath = settings.implicitlyLabel + ' ' + detailPath;
				}

				completions.items.push({
					label: mixin.name,
					kind: CompletionItemKind.Function,
					detail: detailPath,
					documentation: makeMixinDocumentation(mixin),
					insertText: mixin.name
				});
			});
		});
	}

	return completions;
}
