<script lang="ts">
	let { ts, locale }: { ts: number; locale: string } = $props();
	const iso = $derived(new Date(ts).toISOString());
	const text = $derived(
		new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))
	);
</script>

<time datetime={iso}>{text}</time>
