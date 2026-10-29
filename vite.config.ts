import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					// L'editor imposta stili in linea (es. larghezza delle colonne delle tabelle).
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'https:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	// Ambiente interno di Vitest: le dipendenze pre-raggruppate non usano il tsconfig del progetto,
	// e rolldown non sa risolvere "$app/tsconfig" (Tsconfig not found all'avvio dei test).
	environments: { __vitest__: { optimizeDeps: { rolldownOptions: { tsconfig: false } } } },
	test: {
		include: ['src/**/*.test.ts']
	}
});
