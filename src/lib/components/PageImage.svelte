<script lang="ts">
	import { enhance } from '$app/forms';
	import { getT } from '../i18n/index.ts';

	let {
		image,
		title,
		canEdit,
		error = null,
		ok = null
	}: {
		image: { url: string; width: number; height: number } | null;
		title: string;
		canEdit: boolean;
		/** Esito dell'ultimo caricamento (chiavi delle traduzioni). */
		error?: string | null;
		ok?: string | null;
	} = $props();
	const t = getT();

	let form = $state<HTMLFormElement>();
	let input = $state<HTMLInputElement>();
	let over = $state(false);
	let busy = $state(false);
	const message = $derived(busy ? t('pageImage.uploading') : error ? t(error) : ok ? t(ok) : '');

	function upload(file: File) {
		const dt = new DataTransfer();
		dt.items.add(file);
		input!.files = dt.files;
		form!.requestSubmit();
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
		over = false;
		if (!busy) upload(file);
	}

	const sending = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			busy = false;
			await update();
		};
	};
</script>

<div
	class="page-image"
	class:empty={!image}
	class:over
	role="group"
	aria-label={t('pageImage.label')}
	aria-busy={busy}
	ondragover={canEdit ? dragover : undefined}
	ondragleave={canEdit ? dragleave : undefined}
	ondrop={canEdit ? drop : undefined}
>
	{#if image}
		<img src={image.url} alt={title} width={image.width} height={image.height} />
	{:else}
		<div class="placeholder">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<rect x="3" y="4" width="18" height="16" rx="2" />
				<circle cx="9" cy="9.5" r="1.75" />
				<path d="m3.5 18 5.5-5.5 4 4 2.5-2.5 5 5" />
			</svg>
			<p>{canEdit ? t('pageImage.drop') : t('pageImage.none')}</p>
		</div>
	{/if}

	{#if canEdit}
		<div class="tools">
			<form bind:this={form} method="post" action="?/image" enctype="multipart/form-data" use:enhance={sending}>
				<input
					bind:this={input}
					type="file"
					name="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					aria-label={t('pageImage.file')}
					hidden
					onchange={(e) => {
						const f = e.currentTarget.files?.[0];
						if (f) form!.requestSubmit();
					}}
				/>
				<button class="btn btn-small" type="button" disabled={busy} onclick={() => input!.click()}>
					{image ? t('pageImage.change') : t('pageImage.choose')}
				</button>
			</form>
			{#if image}
				<form method="post" action="?/removeImage" use:enhance={sending}>
					<button
						class="btn btn-small btn-danger"
						type="submit"
						disabled={busy}
						onclick={(e) => {
							if (!confirm(t('pageImage.confirmRemove'))) e.preventDefault();
						}}
					>
						{t('pageImage.remove')}
					</button>
				</form>
			{/if}
		</div>
		<p class="status" class:failed={!busy && !!error} role="status">{message}</p>
	{/if}
</div>

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
		font-size: 0.95rem;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.status {
		margin: 0;
		font-size: 0.9rem;
		color: var(--c-muted);
	}
	.status.failed {
		color: var(--c-danger);
		font-weight: 600;
	}
</style>
