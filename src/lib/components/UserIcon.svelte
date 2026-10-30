<script lang="ts">
	import { PAGE_ICONS } from '../pageIcons.ts';

	let { icon, size = '2.25rem' }: { icon: string | null | undefined; size?: string } = $props();
	// Senza icona scelta: la sagoma di una persona.
	const d = $derived(PAGE_ICONS[icon ?? ''] ?? PAGE_ICONS.person);
</script>

<span class="user-icon" style:--size={size} aria-hidden="true"><svg viewBox="0 0 24 24"><path {d} /></svg></span>

<style>
	.user-icon {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: var(--c-surface2);
		border: 1px solid var(--c-border);
		color: var(--c-primary);
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
