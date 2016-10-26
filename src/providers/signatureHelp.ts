'use strict';

import {
	SignatureHelp,
	SignatureInformation,
	TextDocument
} from 'vscode-languageserver';
import { tokenizer } from 'less-symbols-parser';

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
function parseArgumentsAtLine(text: string): IMixinEntry {
	text = text.trim();
	if (text.includes('{')) {
		text = text.slice(text.indexOf('{') + 1, text.length).trim();
	}

	const name = text.match(/([^\(]+)/);
	const paramsString = text.slice(text.indexOf('(') + 1, text.length);

	let parameters = [];
	if (paramsString.length !== 0) {
		const tokens = tokenizer(paramsString);

		let pos = 0;
		let token;
		let param = '';
		while (pos < tokens.length) {
			token = tokens[pos];
			if (token[1] === ',' || token[1] === ';') {
				parameters.push(param);
				param = '';
			} else if (token[1].endsWith(',')) {
				token[1] = token[1].slice(0, -1);
				tokens.splice(pos + 1, 0, ['word', ',', 0]);
				pos--;
			} else {
				param += token[1];
			}
			pos++;
		}
		parameters.push('');
	}

	return {
		name: name ? name[1] : null,
		parameters
	};
}

/**
 * Do Signature Help :)
 */
export function doSignatureHelp(document: TextDocument, offset: number, cache: ICache, settings: ISettings): SignatureHelp {
	const mixins: { name: string; parameters: IVariable[]; }[] = [];

	const ret: SignatureHelp = {
		activeSignature: 0,
		activeParameter: 0,
		signatures: []
	};

	// Skip suggestions if the text not include `(` or include `);`
	const textBeforeWord = getTextBeforePosition(document.getText(), offset);
	if (textBeforeWord.endsWith(');') || !textBeforeWord.includes('(')) {
		return ret;
	}

	const entry = parseArgumentsAtLine(textBeforeWord);
	if (!entry.name) {
		return ret;
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
		return ret;
	}

	ret.activeParameter = Math.max(0, entry.parameters.length - 1);

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
