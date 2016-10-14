'use strict';

import * as assert from 'assert';

import { TextDocument } from 'vscode-languageserver';
import { getLESSLanguageService } from 'vscode-css-languageservice';

import { INode, NodeType } from '../types/nodes';
import { makeMixin } from './mixin';

const ls = getLESSLanguageService();

ls.configure({
	lint: false,
	validate: false
});

function parseText(text: string[], naked = false): INode {
	const doc = TextDocument.create('test.less', 'less', 1, text.join('\n'));
	const ast = <INode>ls.parseStylesheet(doc);

	return naked ? ast : ast.getChildren()[0];
}

describe('Mixin', () => {

	it('Simple', () => {
		const ast = parseText([
			'.a() {',
			'  content: "1"',
			'}'
		]);

		const mixin = makeMixin(ast);

		assert.equal(mixin.name, '.a');
		assert.equal(mixin.parameters.length, 0);
		assert.equal(mixin.parent, null);
	});

	it('Parameters', () => {
		const ast = parseText([
			'.a(@a: 1, @b) {',
			'  content: "1";',
			'}'
		]);

		const mixin = makeMixin(ast);

		assert.equal(mixin.name, '.a');

		assert.equal(mixin.parameters[0].name, '@a');
		assert.equal(mixin.parameters[0].value, '1');

		assert.equal(mixin.parameters[1].name, '@b');
		assert.equal(mixin.parameters[1].value, null);

		assert.equal(mixin.parent, null);
	});

	it('Nesting', (done) => {
		const ast = parseText([
			'.a-@{test} {',
			'  .b(@a: 1, @b) {',
			'    content: "1";',
			'  }',
			'}'
		], true);

		ast.accept((node: INode) => {
			if (node.type === NodeType.MixinDeclaration) {
				const mixin = makeMixin(node);

				assert.equal(mixin.name, '.b');

				assert.equal(mixin.parameters[0].name, '@a');
				assert.equal(mixin.parameters[0].value, '1');

				assert.equal(mixin.parameters[1].name, '@b');
				assert.equal(mixin.parameters[1].value, null);

				assert.equal(mixin.parent, '.a-@{test}');

				done();
			}

			return true;
		});
	});

});
