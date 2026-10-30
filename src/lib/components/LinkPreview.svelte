<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * Anteprima dei collegamenti alle pagine: compare passando col mouse o arrivandoci con la tastiera su a.wikilink[data-title].
	 * Dentro una finestra in sovraimpressione (<dialog>) serve una copia sua, con `within`: quella della pagina resterebbe sotto.
	 */
	let { within = null }: { within?: HTMLElement | null } = $props();

	interface Preview {
		title: string;
		excerpt: string;
		image: string;
	}

	const WIDTH = 320;
	let data = $state<Preview | null>(null);
	let pos = $state({ top: 0, left: 0, above: false });
	let link: HTMLAnchorElement | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function show(a: HTMLAnchorElement) {
		hide();
		link = a;
		const r = a.getBoundingClientRect();
		const above = r.bottom + 280 > window.innerHeight && r.top > 280;
		pos = {
			top: above ? r.top - 8 : r.bottom + 8,
			left: Math.max(16, Math.min(r.left, window.innerWidth - Math.min(WIDTH, window.innerWidth - 32) - 16)),
			above
		};
		const d = a.dataset;
		data = { title: d.title ?? '', excerpt: d.excerpt ?? '', image: d.image ? `/files/${d.image}` : '' };
		a.setAttribute('aria-describedby', 'link-preview');
	}

	function hide() {
		clearTimeout(timer);
		link?.removeAttribute('aria-describedby');
		link = null;
		data = null;
	}

	const target = (e: Event) => {
		const a = (e.target as HTMLElement).closest?.<HTMLAnchorElement>('a.wikilink[data-title]') ?? null;
		return a && (within ? within.contains(a) : !a.closest('dialog')) ? a : null;
	};

	onMount(() => {
		const onOver = (e: MouseEvent) => {
			const a = target(e);
			if (!a || a === link) return;
			clearTimeout(timer);
			timer = setTimeout(() => show(a), 250);
		};
		const onOut = (e: MouseEvent) => {
			const a = target(e);
			if (!a || a.contains(e.relatedTarget as Node)) return;
			clearTimeout(timer);
			if (a === link) timer = setTimeout(hide, 100);
		};
		const onFocus = (e: FocusEvent) => {
			const a = target(e);
			if (a) show(a);
		};
		const onBlur = (e: FocusEvent) => {
			if (target(e) === link) hide();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') hide();
		};
		const listeners: [string, EventListener][] = [
			['mouseover', onOver as EventListener],
			['mouseout', onOut as EventListener],
			['focusin', onFocus as EventListener],
			['focusout', onBlur as EventListener],
			['keydown', onKey as EventListener],
			['click', hide],
			['scroll', hide]
		];
		for (const [ev, fn] of listeners) document.addEventListener(ev, fn, true);
		return () => {
			hide();
			for (const [ev, fn] of listeners) document.removeEventListener(ev, fn, true);
		};
	});
</script>

{#if data}
	<div
		id="link-preview"
		class="link-preview"
		class:above={pos.above}
		role="tooltip"
		style="top:{pos.top}px;left:{pos.left}px;--w:{WIDTH}px"
	>
		{#if data.image}<img src={data.image} alt="" />{/if}
		<div class="body">
			<p class="title">{data.title}</p>
			{#if data.excerpt}<p class="excerpt">{data.excerpt}</p>{/if}
		</div>
	</div>
{/if}

<style>
	.link-preview {
		position: fixed;
		z-index: 70;
		width: min(var(--w), calc(100vw - 2rem));
		pointer-events: none;
		background: var(--c-surface);
		color: var(--c-text);
		border: 1px solid var(--c-border);
		border-top: 3px solid var(--c-primary);
		border-radius: var(--radius);
		box-shadow:
			0 2px 6px rgb(0 0 0 / 0.12),
			0 12px 32px rgb(0 0 0 / 0.22);
		overflow: hidden;
		animation: pop 120ms ease-out;
	}
	.above {
		transform: translateY(-100%);
		animation-name: pop-above;
	}
	img {
		display: block;
		width: 100%;
		height: 8.5rem;
		object-fit: cover;
		border-bottom: 1px solid var(--c-border);
	}
	.body {
		padding: 0.7rem 0.9rem 0.8rem;
	}
	.title {
		margin: 0;
		font-family: var(--font-head);
		font-size: var(--fs-md);
		font-weight: 700;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
	.excerpt {
		margin: 0.4rem 0 0;
		font-size: var(--fs-sm);
		line-height: 1.5;
		color: var(--c-muted);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
		line-clamp: 5;
		overflow: hidden;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	@keyframes pop-above {
		from {
			opacity: 0;
			transform: translateY(calc(-100% - 4px));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.link-preview {
			animation: none;
		}
	}
</style>
