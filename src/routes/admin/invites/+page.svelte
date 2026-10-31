<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import Invites from '#lib/components/Invites.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('admin.invites')}</title></svelte:head>

<h2>{t('admin.invites')}</h2>
<p>{t('admin.invitesIntro')}</p>
<Invites invites={data.invites} roles={data.roles} {form} />
