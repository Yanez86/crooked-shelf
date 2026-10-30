/** Versioni lette da CHANGELOG.md: «## versione — data», «### sezione», «- voce». Il resto si ignora. */
export interface Release {
	version: string;
	date: string;
	sections: { title: string; items: string[] }[];
}

export function parseChangelog(md: string): Release[] {
	const releases: Release[] = [];
	for (const line of md.split(/\r?\n/)) {
		const rel = releases.at(-1);
		const sec = rel?.sections.at(-1);
		if (line.startsWith('## ')) {
			const [version, date = ''] = line.slice(3).split(/\s+[—-]\s+/);
			releases.push({ version: version.trim(), date: date.trim(), sections: [] });
		} else if (line.startsWith('### ') && rel) rel.sections.push({ title: line.slice(4).trim(), items: [] });
		else if (line.startsWith('- ') && sec) sec.items.push(line.slice(2).trim());
	}
	return releases;
}
