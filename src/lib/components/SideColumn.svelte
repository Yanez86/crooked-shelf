<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import { getT } from '../i18n/index.ts';
	import type { PageField } from '../content/types.ts';
	import Icon from './Icon.svelte';

	/**
	 * La colonna a lato in modifica. Di base non c'è: il «+» la aggiunge. Dentro, riquadri modificati sul posto:
	 * di testo (un titolo e un testo breve) o immagine (con la didascalia). L'immagine si carica subito,
	 * la pagina la tiene quando si salva. `fixed` = ci sono riquadri fissi (il resoconto di sessione, in `children`):
	 * allora la colonna resta aperta.
	 */
	let { fields, fixed = false, children }: { fields: PageField[]; fixed?: boolean; children?: Snippet } = $props();
	const t = getT();

	interface Box extends PageField {
		key: number;
		// Solo per i riquadri immagine: caricamento ed esito.
		busy?: boolean;
		message?: string;
		failed?: boolean;
		over?: boolean;
	}

	let next = 0;
	let rows = $state<Box[]>(untrack(() => fields.map((f) => ({ ...f, key: next++ }))));
	let open = $state(untrack(() => fixed || fields.length > 0));
	let announce = $state('');
	// Un riquadro immagine ancora senza immagine non si salva.
	const json = $derived(
		JSON.stringify(
			rows.flatMap(({ label, value, image }) =>
				image !== undefined ? (image ? [{ label, value: '', image }] : []) : label.trim() || value.trim() ? [{ label, value }] : []
			)
		)
	);

	async function focus(id: string) {
		await tick();
		document.getElementById(id)?.focus();
	}

	function openColumn() {
		open = true;
		focus('side-add-text');
	}
	function closeColumn() {
		open = false;
		focus('side-open');
	}
	function addText() {
		rows.push({ key: next++, label: '', value: '' });
		announce = t('fields.added');
		focus(`field-label-${rows.length - 1}`);
	}
	function addImage() {
		rows.push({ key: next++, label: '', value: '', image: '' });
		announce = t('fields.added');
		focus(`field-pick-${rows.length - 1}`);
	}
	function remove(i: number) {
		rows.splice(i, 1);
		announce = t('fields.removed');
		focus('side-add-text');
	}
	// La prima immagine è anche quella della pagina (galleria, anteprime): l'ordine conta.
	function move(i: number, d: -1 | 1) {
		const j = i + d;
		const [row] = rows.splice(i, 1);
		rows.splice(j, 0, row);
		announce = t('fields.moved');
		// Il fuoco resta sulla freccia, o passa all'altra se in cima o in fondo questa non serve più.
		const dir = (d < 0 && j > 0) || j === rows.length - 1 ? 'up' : 'down';
		focus(`field-${dir}-${j}`);
	}
	const boxName = (row: Box, i: number) => (row.image !== undefined ? t('fields.image', { n: i + 1 }) : t('fields.label', { n: i + 1 }));

	async function upload(box: Box, file: File) {
		box.busy = true;
		box.failed = false;
		box.message = t('fields.uploading');
		const body = new FormData();
		body.append('file', file);
		const r = await fetch('/api/files', { method: 'POST', body }).catch(() => null);
		const data = r ? await r.json().catch(() => ({})) : {};
		box.busy = false;
		if (r?.ok && data.id) {
			box.image = data.id;
			box.message = t('fields.uploaded');
		} else {
			box.failed = true;
			box.message = t(data.error ?? 'errors.generic');
		}
	}

	function dragover(e: DragEvent, box: Box) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		box.over = true;
	}
	function dragleave(e: DragEvent, box: Box) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) box.over = false;
	}
	function drop(e: DragEvent, box: Box) {
		const file = e.dataTransfer?.files[0];
		if (!file) return;
		e.preventDefault();
		box.over = false;
		if (!box.busy) upload(box, file);
	}
</script>

<input type="hidden" name="fields" value={json} />

{#snippet removeButton(row: Box, i: number, cls: string)}
	<button class="{cls} remove" type="button" title={t('common.delete')} onclick={() => remove(i)}>
		<Icon name="close" /><span class="visually-hidden">{t('common.delete')}: {boxName(row, i)}</span>
	</button>
{/snippet}

<!-- Con l'immagine, la crocetta sta sull'immagine stessa: qui restano le frecce. -->
{#snippet tools(row: Box, i: number)}
	<div class="tools">
		{#if !row.image}{@render removeButton(row, i, 'tool')}{/if}
		<button id="field-up-{i}" class="tool" type="button" title={t('fields.moveUp')} disabled={i === 0} onclick={() => move(i, -1)}>
			<Icon name="arrowUp" /><span class="visually-hidden">{t('fields.moveUp')}: {boxName(row, i)}</span>
		</button>
		<button id="field-down-{i}" class="tool" type="button" title={t('fields.moveDown')} disabled={i === rows.length - 1} onclick={() => move(i, 1)}>
			<Icon name="arrowDown" /><span class="visually-hidden">{t('fields.moveDown')}: {boxName(row, i)}</span>
		</button>
	</div>
{/snippet}

{#if open}
	<section class="side" aria-label={t('fields.column')}>
		{@render children?.()}
		{#each rows as row, i (row.key)}
			{#if row.image !== undefined}
				<div
					class="box image-box"
					class:over={row.over}
					role="group"
					aria-label={t('fields.image', { n: i + 1 })}
					aria-busy={row.busy}
					ondragover={(e) => dragover(e, row)}
					ondragleave={(e) => dragleave(e, row)}
					ondrop={(e) => drop(e, row)}
				>
					{#if row.image}
						<div class="frame">
							<img src="/files/{row.image}" alt="" />
							<!-- Come la matita della pagina: si cambia e si cancella dall'immagine stessa. -->
							<div class="on-image">
								<button id="field-pick-{i}" class="on-tool" type="button" title={t('fields.changeImage')} disabled={row.busy} onclick={() => document.getElementById(`field-file-${i}`)?.click()}>
									<Icon name="edit" /><span class="visually-hidden">{t('fields.changeImage')}: {boxName(row, i)}</span>
								</button>
								{@render removeButton(row, i, 'on-tool')}
							</div>
						</div>
					{:else}
						<p class="drop">{t('fields.drop')}</p>
						<button id="field-pick-{i}" class="btn btn-small pick" type="button" disabled={row.busy} onclick={() => document.getElementById(`field-file-${i}`)?.click()}>
							{t('fields.chooseImage')}
						</button>
					{/if}
					<input
						id="field-file-{i}"
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif"
						aria-label={t('fields.file', { n: i + 1 })}
						hidden
						onchange={(e) => {
							const f = e.currentTarget.files?.[0];
							e.currentTarget.value = '';
							if (f) upload(row, f);
						}}
					/>
					<p class="status" class:failed={row.failed} role="status">{row.message ?? ''}</p>
					<label class="visually-hidden" for="field-caption-{i}">{t('fields.caption', { n: i + 1 })}</label>
					<input id="field-caption-{i}" class="caption" type="text" maxlength="200" placeholder={t('fields.captionPlaceholder')} bind:value={row.label} />
					{@render tools(row, i)}
				</div>
			{:else}
				<div class="box">
					<label class="visually-hidden" for="field-label-{i}">{t('fields.label', { n: i + 1 })}</label>
					<input id="field-label-{i}" class="box-label" type="text" maxlength="60" placeholder={t('fields.labelPlaceholder')} bind:value={row.label} />
					<label class="visually-hidden" for="field-value-{i}">{t('fields.value', { n: i + 1 })}</label>
					<input id="field-value-{i}" class="box-value" type="text" maxlength="500" placeholder={t('fields.valuePlaceholder')} bind:value={row.value} />
					{@render tools(row, i)}
				</div>
			{/if}
		{/each}
		<div class="adds" role="group" aria-labelledby="side-add-label">
			<span id="side-add-label" class="adds-label">{t('fields.add')}</span>
			<button id="side-add-text" class="add" type="button" onclick={addText}><Icon name="plus" />{t('fields.text')}</button>
			<button class="add" type="button" onclick={addImage}><Icon name="plus" />{t('fields.imageBox')}</button>
		</div>
		{#if !fixed && !rows.length}
			<button class="close" type="button" onclick={closeColumn}>{t('fields.removeColumn')}</button>
		{/if}
		<p class="visually-hidden" aria-live="polite">{announce}</p>
	</section>
{:else}
	<button id="side-open" class="open" type="button" title={t('fields.addColumn')} onclick={openColumn}>
		<Icon name="plus" /><span class="visually-hidden">{t('fields.addColumn')}</span>
	</button>
{/if}

<style>
	/* Come la colonna della pagina: un riquadro a sé, staccato dal testo. */
	.side {
		width: 20rem;
		max-width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
		padding: 1rem;
	}
	.open {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		font: inherit;
		font-size: 1.5rem;
		line-height: 1;
		border: 1px dashed var(--c-control);
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.open:hover,
	.open:focus-visible {
		color: var(--c-primary);
		border-color: var(--c-primary);
		background: var(--c-surface);
	}
	.box {
		position: relative;
		display: flex;
		flex-direction: column;
		/* Spazio per elimina e frecce, in colonna a destra. */
		min-height: 5.1rem;
		padding: 0.4rem 2rem 0.4rem 0.5rem;
		border-radius: var(--radius);
		outline: 1px dashed var(--c-border);
	}
	.box:hover {
		outline-color: var(--c-control);
		background: var(--c-surface2);
	}
	.box:focus-within {
		outline: 2px solid var(--c-primary);
		background: var(--c-surface2);
	}
	/* Gli input sembrano testo: si scrive dove si legge. */
	.box input[type='text'] {
		border: 0;
		background: none;
		padding: 0.1rem 0;
		min-height: 0;
		width: 100%;
	}
	.box input:focus {
		outline: none;
	}
	.box-label {
		font-weight: 700;
	}
	.image-box {
		gap: 0.4rem;
	}
	.image-box.over {
		outline: 3px dashed var(--c-primary);
		outline-offset: 2px;
	}
	.frame {
		position: relative;
	}
	.image-box img {
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
	/* Stessa misura della matita della pagina; con un fondo pieno, perché si vedano su qualsiasi immagine. */
	.on-tool {
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
	.on-tool:hover:not(:disabled),
	.on-tool:focus-visible {
		color: var(--c-primary);
	}
	.on-tool.remove:hover,
	.on-tool.remove:focus-visible {
		color: var(--c-danger);
	}
	.on-tool:disabled {
		cursor: progress;
		opacity: 0.6;
	}
	.drop {
		margin: 0;
		padding: 1.5rem 0.75rem;
		text-align: center;
		font-size: var(--fs-sm);
		color: var(--c-muted);
		border: 2px dashed var(--c-control);
		border-radius: var(--radius);
	}
	.over .drop {
		border-style: solid;
		border-color: var(--c-primary);
	}
	.pick {
		align-self: flex-start;
	}
	.status {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.status:empty {
		display: none;
	}
	.status.failed {
		color: var(--c-danger);
		font-weight: 600;
	}
	.caption {
		font-size: var(--fs-sm);
	}
	.tools {
		position: absolute;
		top: 0.2rem;
		right: 0.2rem;
		display: flex;
		flex-direction: column;
	}
	.tool {
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}
	.tool:hover:not(:disabled),
	.tool:focus-visible {
		color: var(--c-primary);
		background: var(--c-surface);
	}
	.tool:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.remove {
		font-size: 1.1rem;
	}
	.remove:hover,
	.remove:focus-visible {
		color: var(--c-danger);
	}
	.adds {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.adds-label {
		flex-basis: 100%;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.add {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		font: inherit;
		font-size: var(--fs-sm);
		padding: 0.5rem;
		border: 1px dashed var(--c-control);
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.add:hover,
	.add:focus-visible {
		color: var(--c-primary);
		border-color: var(--c-primary);
	}
	.close {
		align-self: flex-start;
		font: inherit;
		font-size: var(--fs-sm);
		min-height: 1.5rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--c-link);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
