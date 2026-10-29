<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	let { message }: { message?: string | null } = $props();
	const t = getT();
</script>

<div role="status">
	{#if message}
		<div class="alert alert-ok"><span>{t(message)}</span></div>
	{/if}
</div>
