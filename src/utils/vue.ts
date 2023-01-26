import { TextDocument, Position } from 'vscode-languageserver';

type Region = [number, number];

export function isVueFile(path: string) {
	return path.endsWith('.vue');
}

export function getVueLessRegions(content: string) {
	const regions: Region[] = [];
	const startRe = /<style[\w=\"\' \n\t]{1,}lang=[\"\']less[\"\'][\w=\"\' \n\t]{0,}>/g;
	const endRe = /<\/style>/g;
	/* tslint:disable:no-conditional-assignment */
	let start: RegExpExecArray | null;
	let end: RegExpExecArray | null;
	while ((start = startRe.exec(content)) !== null && (end = endRe.exec(content)) !== null) {
		if (start[0] !== undefined) {
			regions.push([start.index + start[0].length, end.index]);
		}
	}
	return regions;
}

export function getVueLessContent(content: string, regions = getVueLessRegions(content)) {
	const oldContent = content;

	let newContent = oldContent
		.split('\n')
		.map((line) => ' '.repeat(line.length))
		.join('\n');

	for (const r of regions) {
		newContent = newContent.slice(0, r[0]) + oldContent.slice(r[0], r[1]) + newContent.slice(r[1]);
	}

	return newContent;
}

function convertVueTextDocument(document: TextDocument, regions: Region[]) {
	return TextDocument.create(document.uri, 'less', document.version, getVueLessContent(document.getText(), regions));
}

export function getLessRegionsDocument(document: TextDocument, position: Position) {
	const offset = document.offsetAt(position);
	if (!isVueFile(document.uri)) {
		return { document, offset };
	}

	const vueLessRegions = getVueLessRegions(document.getText());
	if (vueLessRegions.some((region) => region[0] <= offset && region[1] >= offset)) {
		return { document: convertVueTextDocument(document, vueLessRegions), offset };
	}
	return { document: null, offset };
}
