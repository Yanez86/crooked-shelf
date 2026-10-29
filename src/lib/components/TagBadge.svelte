<script lang="ts">
	let { tag }: { tag: { name: string; slug: string; color: string } } = $props();
</script>

<a class="badge" href="/wiki?tag={encodeURIComponent(tag.slug)}">
	<span class="tag-dot tag-{tag.color}" aria-hidden="true"></span>{tag.name}
</a>
