<script lang="ts">
	import { PAGE_ICONS } from '../pageIcons.ts';

	let { icon, avatar = null, size = '2.25rem' }: { icon: string | null | undefined; avatar?: string | null; size?: string } = $props();
	// Senza icona scelta: la sagoma di una persona.
	const d = $derived(PAGE_ICONS[icon ?? ''] ?? PAGE_ICONS.person);
</script>

<!-- L'immagine caricata, se c'è, prende il posto dell'icona. -->
<span class="user-icon" style:--size={size} aria-hidden="true">
	{#if avatar}<img src="/files/{avatar}" alt="" />{:else}<svg viewBox="0 0 24 24"><path {d} /></svg>{/if}
</span>

<style>
	.user-icon {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: var(--size);
		height: var(--size);
		overflow: hidden;
		border-radius: var(--radius);
		background: var(--c-surface2);
		border: 1px solid var(--c-border);
		color: var(--c-primary);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	svg {
		width: 60%;
		height: 60%;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
