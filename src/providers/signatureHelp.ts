'use strict';

import {
	SignatureHelp,
	SignatureInformation,
	TextDocument
} from 'vscode-languageserver';

import { IVariable } from '../types/symbols';
import { ISettings } from '../types/settings';
import { ICache } from '../services/cache';

import { parseDocument } from '../services/parser';
import { getSymbolsCollection } from '../utils/symbols';
import { getTextBeforePosition } from '../utils/string';

interface IMixinEntry {
	name: string;
	parameters: string[];
}

/**
 * Returns Mixin name and its parameters from line.
 */
function parseMixinAtLine(text: string): IMixinEntry {
	text = text.trim();
	if (text.includes('{')) {
		text = text.slice(text.indexOf('{') + 1, text.length).trim();
	}

	const name = text.match(/([^\(]+)/)[1] || null;
	const paramsString = text.slice(text.indexOf('(') + 1, text.length);

	let parameters = [];
	if (paramsString.length !== 0) {
		let pos = 0;
		let char;
		let push = 0;
		let quotes = false;
		let param = '';
		while (pos < paramsString.length) {
			char = paramsString.charAt(pos);
			if ((char === ',' || char === ';') && push === 0) {
				parameters.push(param);
				param = '';
			} else if ('({['.includes(char)) {
				push++;
			} else if (']})'.includes(char)) {
				push--;
			} else if ('\'"'.includes(char) && paramsString.charAt(pos - 1) !== '\\') {
				quotes = !quotes;
				push = quotes ? push + 1 : push - 1;
			}
			param += char;
			pos++;
		}
		parameters.push('');
	}

	return {
		name,
		parameters
	};
}

/**
 * Do Signature Help :)
 */
export function doSignatureHelp(document: TextDocument, offset: number, cache: ICache, settings: ISettings): SignatureHelp {
	const mixins: { name: string; parameters: IVariable[]; }[] = [];

	// Skip suggestions if the text not include `(` or include `);`
	const textBeforeWord = getTextBeforePosition(document.getText(), offset);
	if (textBeforeWord.endsWith(');') || !textBeforeWord.includes('(')) {
		return null;
	}

	const entry = parseMixinAtLine(textBeforeWord);
	if (!entry.name) {
		return null;
	}

	const resource = parseDocument(document, offset, settings);
	const symbolsList = getSymbolsCollection(cache).concat(resource.symbols);

	symbolsList.forEach((symbols) => {
		symbols.mixins.forEach((mixin) => {
			if (entry.name === mixin.name && mixin.parameters.length >= entry.parameters.length) {
				mixins.push({
					name: mixin.name,
					parameters: mixin.parameters
				});
			}
		});
	});

	if (mixins.length === 0) {
		return null;
	}

	const ret: SignatureHelp = {
		activeSignature: 0,
		activeParameter: Math.max(0, entry.parameters.length - 1),
		signatures: []
	};

	mixins.forEach((mixin) => {
		const paramsString = mixin.parameters.map((x) => `${x.name}: ${x.value}`).join(', ');
		const signatureInfo = SignatureInformation.create(`${mixin.name} (${paramsString})`);

		mixin.parameters.forEach((param) => {
			signatureInfo.parameters.push({
				label: param.name,
				documentation: ''
			});
		});

		ret.signatures.push(signatureInfo);
	});

	return ret;
}
