import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: 'it-IT',
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// Database nuovo a ogni esecuzione.
		command: `rm -rf .e2e-data && npm run build && CS_DATA_DIR=.e2e-data PORT=${PORT} node server.js`,
		url: `http://localhost:${PORT}/login`,
		timeout: 180_000,
		reuseExistingServer: false
	}
});
