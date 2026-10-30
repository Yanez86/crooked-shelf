<script lang="ts">
	import { deserialize } from '$app/forms';
	import { getT } from '../i18n/index.ts';

	type Image = { url: string; width: number; height: number };

	let {
		image,
		title,
		canEdit
	}: {
		image: Image | null;
		title: string;
		/** Solo nella pagina in modifica: l'immagine si cambia e si toglie da sé stessa, e si salva subito. */
		canEdit: boolean;
	} = $props();
	const t = getT();

	// Dopo un caricamento mostra la nuova immagine senza ricaricare: il testo non ancora salvato resta.
	let shown = $derived(image);
	let input = $state<HTMLInputElement>();
	let over = $state(false);
	// Un file trascinato da fuori sopra la finestra: solo allora compare il riquadro vuoto.
	let dragging = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let ok = $state<string | null>(null);
	const message = $derived(busy ? t('pageImage.uploading') : error ? t(error) : ok ? t(ok) : '');

	/** Le azioni della pagina di modifica, chiamate senza <form>: siamo già dentro il modulo della pagina. */
	async function send(action: 'image' | 'removeImage', body = new FormData()) {
		busy = true;
		error = ok = null;
		try {
			const res = await fetch(`?/${action}`, { method: 'POST', body, headers: { accept: 'application/json', 'x-sveltekit-action': 'true' } });
			const r = deserialize(await res.text());
			if (r.type === 'success') {
				shown = (r.data?.image as Image | null) ?? null;
				ok = r.data?.imageOk as string;
			} else {
				error = (r.type === 'failure' && (r.data?.imageError as string)) || 'pageImage.failed';
			}
		} catch {
			error = 'pageImage.failed';
		} finally {
			busy = false;
			// Così si può scegliere di nuovo lo stesso file.
			if (input) input.value = '';
		}
	}

	function upload(file: File) {
		const body = new FormData();
		body.append('file', file);
		send('image', body);
	}

	function remove() {
		if (confirm(t('pageImage.confirmRemove'))) send('removeImage');
	}

	function dragover(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		over = true;
	}

	function dragleave(e: DragEvent) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) over = false;
	}

	function drop(e: DragEvent) {
		const file = e.dataTransfer?.files[0];
		if (!file) return;
		e.preventDefault();
		over = dragging = false;
		if (!busy) upload(file);
	}

	const windowDrag = {
		dragenter: (e: DragEvent) => {
			if (e.dataTransfer?.types.includes('Files')) dragging = true;
		},
		// relatedTarget nullo = il file è uscito dalla finestra.
		dragleave: (e: DragEvent) => {
			if (!e.relatedTarget) dragging = false;
		},
		drop: () => (dragging = false),
		dragend: () => (dragging = false)
	};
</script>

<svelte:window
	ondragenter={canEdit ? windowDrag.dragenter : undefined}
	ondragleave={canEdit ? windowDrag.dragleave : undefined}
	ondrop={canEdit ? windowDrag.drop : undefined}
	ondragend={canEdit ? windowDrag.dragend : undefined}
/>

<!-- Senza immagine e senza permessi non c'è niente da mostrare. -->
{#if shown || canEdit}
<div
	class="page-image"
	class:bare={!shown && !dragging}
	class:over
	role="group"
	aria-label={t('pageImage.label')}
	aria-busy={busy}
	ondragover={canEdit ? dragover : undefined}
	ondragleave={canEdit ? dragleave : undefined}
	ondrop={canEdit ? drop : undefined}
>
	{#if shown}
		<div class="frame">
			<img src={shown.url} alt={title} width={shown.width} height={shown.height} />
			{#if canEdit}
				<!-- Come la matita della pagina: solo un segno, sull'immagine stessa. -->
				<div class="on-image">
					<button class="icon" type="button" title={t('pageImage.change')} disabled={busy} onclick={() => input!.click()}>
						<span aria-hidden="true">✎</span><span class="visually-hidden">{t('pageImage.change')}</span>
					</button>
					<button class="icon danger" type="button" title={t('pageImage.remove')} disabled={busy} onclick={remove}>
						<span aria-hidden="true">×</span><span class="visually-hidden">{t('pageImage.remove')}</span>
					</button>
				</div>
			{/if}
		</div>
	{:else if dragging}
		<div class="placeholder">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<rect x="3" y="4" width="18" height="16" rx="2" />
				<circle cx="9" cy="9.5" r="1.75" />
				<path d="m3.5 18 5.5-5.5 4 4 2.5-2.5 5 5" />
			</svg>
			<p>{t('pageImage.drop')}</p>
		</div>
	{/if}

	{#if canEdit}
		<!-- Senza name: non parte con il modulo della pagina. -->
		<input
			bind:this={input}
			type="file"
			accept="image/png,image/jpeg,image/webp,image/gif"
			aria-label={t('pageImage.file')}
			hidden
			onchange={(e) => {
				const f = e.currentTarget.files?.[0];
				if (f) upload(f);
			}}
		/>
		{#if !shown}
			<button class="btn btn-small btn-ghost add" type="button" disabled={busy} onclick={() => input!.click()}>+ {t('pageImage.add')}</button>
		{/if}
		<p class="status" class:failed={!busy && !!error} role="status">{message}</p>
	{/if}
</div>
{/if}

<style>
	.page-image {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-radius: var(--radius);
	}
	.page-image.over {
		outline: 3px dashed var(--c-primary);
		outline-offset: 3px;
	}
	.frame {
		position: relative;
	}
	img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 28rem;
		object-fit: contain;
		background: var(--c-surface2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
	}
	.on-image {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		display: flex;
		gap: 0.25rem;
	}
	/* Stessa misura della matita; con un fondo pieno, perché si vedano su qualsiasi immagine. */
	.icon {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-muted);
		font: inherit;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
	}
	.icon:hover:not(:disabled),
	.icon:focus-visible {
		color: var(--c-primary);
	}
	.icon.danger:hover:not(:disabled),
	.icon.danger:focus-visible {
		color: var(--c-danger);
	}
	.icon:disabled {
		cursor: progress;
		opacity: 0.6;
	}
	.add {
		align-self: flex-start;
	}
	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		aspect-ratio: 4 / 3;
		padding: 1rem;
		text-align: center;
		color: var(--c-muted);
		background: var(--c-surface);
		border: 2px dashed var(--c-control);
		border-radius: var(--radius);
	}
	.over .placeholder {
		background: var(--c-surface2);
		border-style: solid;
		border-color: var(--c-primary);
	}
	.placeholder svg {
		width: 3rem;
		height: 3rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.placeholder p {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.status {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.status.failed {
		color: var(--c-danger);
		font-weight: 600;
	}
</style>
