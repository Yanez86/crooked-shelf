import type { PageServerLoad } from './$types';
import { parseChangelog } from '#lib/changelog.ts';
import changelog from '../../../CHANGELOG.md?raw';

const releases = parseChangelog(changelog);

export const load: PageServerLoad = () => ({ releases });
