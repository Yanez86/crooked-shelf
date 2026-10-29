<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	let { error, params }: { error?: string | null; params?: Record<string, string | number> } = $props();
	const t = getT();
</script>

{#if error}
	<div class="alert alert-error" role="alert">
		<strong>{t('errors.title')}</strong>
		<span>{t(error, params)}</span>
	</div>
{/if}
