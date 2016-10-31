'use strict';

import { INode, NodeType } from '../types/nodes';
import { IVariable, IMixin } from '../types/symbols';

import { makeVariable } from './variable';
import { getChildByType } from '../utils/ast';

/**
 * Returns information about Mixin Declaraion.
 */
export function makeMixin(node: INode): IMixin {
	const name = node.getName();
	const parameters: IVariable[] = [];

	node.getParameters().getChildren().forEach((child) => {
		if (child.getName()) {
			parameters.push(makeVariable(child, name));
		}
	});

	return {
		name,
		parameters,
		offset: node.offset
	};
}

/**
 * Returns information about set of Variable Declarations.
 */
export function makeMixinCollection(node: INode): IMixin[] {
	return getChildByType(node, NodeType.MixinDeclaration).map(makeMixin);
}
