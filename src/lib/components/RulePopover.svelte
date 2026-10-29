<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { getT } from '../i18n/index.ts';

	/** Anteprima delle regole: si apre dal pulsante "i" accanto a ogni riferimento @regola. */
	const t = getT();

	interface Preview {
		name: string;
		summary: string;
		html: string;
		ddb: string;
		pages: { slug: string; title: string }[];
	}

	let open = $state(false);
	let data = $state<Preview | null>(null);
	let failed = $state(false);
	let pos = $state({ top: 0, left: 0 });
	let opener: HTMLButtonElement | null = null;
	let box: HTMLDivElement | undefined = $state();
	let heading: HTMLHeadingElement | undefined = $state();

	async function show(btn: HTMLButtonElement) {
		opener?.setAttribute('aria-expanded', 'false');
		opener = btn;
		btn.setAttribute('aria-expanded', 'true');
		const r = btn.getBoundingClientRect();
		const width = Math.min(window.innerWidth - 32, 448);
		pos = {
			top: r.bottom + window.scrollY + 6,
			left: Math.max(16, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - width - 16))
		};
		data = null;
		failed = false;
		open = true;
		const res = await fetch(`/api/rules/${btn.dataset.rule}`).catch(() => null);
		if (res?.ok) data = await res.json();
		else failed = true;
		await tick();
		heading?.focus();
	}

	function close(returnFocus = true) {
		if (!open) return;
		open = false;
		opener?.setAttribute('aria-expanded', 'false');
		if (returnFocus) opener?.focus();
	}

	onMount(() => {
		const onClick = (e: MouseEvent) => {
			const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.rule-info');
			if (btn) {
				e.preventDefault();
				if (open && btn === opener) close();
				else show(btn);
			} else if (open && box && !box.contains(e.target as Node)) close(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && open) close();
		};
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

{#if open}
	<div class="rule-pop" role="dialog" aria-labelledby="rule-pop-title" bind:this={box} style="top:{pos.top}px;left:{pos.left}px">
		<button type="button" class="close" aria-label={t('common.close')} onclick={() => close()}>×</button>
		{#if data}
			<h2 id="rule-pop-title" tabindex="-1" bind:this={heading}>{data.name}</h2>
			<p class="summary">{data.summary}</p>
			<div class="text">{@html data.html}</div>
			{#if data.pages.length}
				<p class="house"><strong>{t('rules.citedBy')}</strong>
					{#each data.pages as p, i (p.slug)}{i ? ', ' : ''}<a href="/wiki/{p.slug}">{p.title}</a>{/each}
				</p>
			{/if}
			<p class="links">
				<a href={data.ddb} target="_blank" rel="noopener noreferrer nofollow">{t('rules.openDdb')}<span class="visually-hidden"> {t('rules.external')}</span></a>
			</p>
			<p class="attr">{t('rules.srdShort')}</p>
		{:else}
			<h2 id="rule-pop-title" tabindex="-1" bind:this={heading}>{failed ? t('errors.generic') : '…'}</h2>
		{/if}
	</div>
{/if}

<style>
	.rule-pop {
		position: absolute;
		z-index: 60;
		width: min(28rem, calc(100vw - 2rem));
		max-height: 70vh;
		overflow-y: auto;
		background: var(--c-surface);
		color: var(--c-text);
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
		padding: 0.75rem 1rem;
	}
	h2 {
		margin: 0 2rem 0.25rem 0;
		font-size: var(--fs-lg);
	}
	h2:focus {
		outline: none;
	}
	.summary {
		margin: 0 0 0.5rem;
		font-style: italic;
		color: var(--c-muted);
	}
	.text :global(p) {
		margin: 0.35rem 0;
	}
	.close {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		width: 2.5rem;
		height: 2.5rem;
		font-size: var(--fs-lg);
		line-height: 1;
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
	}
	.attr {
		font-size: var(--fs-sm);
		color: var(--c-muted);
		margin-bottom: 0;
	}
</style>
