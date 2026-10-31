import { deleteFile } from './files.ts';
import { customThemes, saveSettings } from './settings.ts';
import { THEMES, type Theme } from '../themes.ts';

export function findTheme(id: string): Theme | undefined {
	return [...THEMES, ...customThemes()].find((t) => t.id === id);
}

/** Salva un tema creato dall'Admin (nuovo se id è null). Restituisce l'id. */
export function storeTheme(theme: Omit<Theme, 'id'>, id: string | null): string {
	const list = customThemes();
	if (id) {
		const old = list.find((t) => t.id === id)?.background;
		saveSettings({ themes: list.map((t) => (t.id === id ? { ...theme, id } : t)) });
		if (old && old !== theme.background) deleteFile(old);
		return id;
	}
	const n = Math.max(0, ...list.map((t) => Number(t.id.replace('custom-', '')) || 0)) + 1;
	const newId = `custom-${n}`;
	saveSettings({ themes: [...list, { ...theme, id: newId }] });
	return newId;
}

export function removeTheme(id: string) {
	const old = customThemes().find((t) => t.id === id)?.background;
	saveSettings({ themes: customThemes().filter((t) => t.id !== id) });
	if (old) deleteFile(old);
}
