<script lang="ts">
	import { untrack } from 'svelte';
	import Editor from '../editor/Editor.svelte';
	import SideColumn from './SideColumn.svelte';
	import WorldDateInput from './WorldDateInput.svelte';
	import type { CalMonth } from '../calendar.ts';
	import { getT } from '../i18n/index.ts';
	import { PAGE_ICONS } from '../pageIcons.ts';
	import type { DocNode, PageField, SessionInfo } from '../content/types.ts';

	interface Category {
		id: number;
		label: string;
	}

	let {
		values,
		categories,
		visibilities,
		canManage,
		canSecret,
		knownTags,
		updatedAt = null,
		submitLabel,
		cancelHref,
		months
	}: {
		values: {
			title: string;
			content: DocNode;
			visibility: string;
			playersCanEdit: boolean;
			categoryId: number | null;
			tags: string;
			slug?: string;
			fields: PageField[];
			template?: string | null;
			session: SessionInfo | null;
			icon?: string | null;
		};
		categories: Category[];
		visibilities: string[];
		canManage: boolean;
		canSecret: boolean;
		knownTags: string[];
		updatedAt?: number | null;
		submitLabel: string;
		cancelHref: string;
		months: CalMonth[];
	} = $props();

	const t = getT();
	let icon = $state(untrack(() => values.icon ?? ''));
</script>

<!-- Stesso aspetto della pagina: si scrive dove si legge. -->
<form method="post" action="?/save" class="page-form">
	{#if updatedAt}<input type="hidden" name="updatedAt" value={updatedAt} />{/if}
	{#if values.slug}<input type="hidden" name="slug" value={values.slug} />{/if}
	{#if values.template}<input type="hidden" name="template" value={values.template} />{/if}

	<header class="page-head">
		<details class="icon-pick">
			<summary title={t('page.icon')}>
				{#if PAGE_ICONS[icon]}
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d={PAGE_ICONS[icon]} /></svg>
				{:else}
					<span aria-hidden="true">∅</span>
				{/if}
				<span class="visually-hidden">{t('page.icon')}</span>
			</summary>
			<fieldset class="icons">
				<legend class="visually-hidden">{t('page.icon')}</legend>
				<label class="icon-choice" title={t('page.noIcon')}>
					<input type="radio" name="icon" value="" bind:group={icon} />
					<span aria-hidden="true">∅</span><span class="visually-hidden">{t('page.noIcon')}</span>
				</label>
				{#each Object.entries(PAGE_ICONS) as [name, d] (name)}
					<label class="icon-choice" title={t(`page.icons.${name}`)}>
						<input type="radio" name="icon" value={name} bind:group={icon} />
						<svg viewBox="0 0 24 24" aria-hidden="true"><path {d} /></svg><span class="visually-hidden">{t(`page.icons.${name}`)}</span>
					</label>
				{/each}
			</fieldset>
		</details>
		<label class="visually-hidden" for="title">{t('page.title')}</label>
		<input id="title" name="title" type="text" required maxlength="200" value={values.title} placeholder={t('page.title')} class="title-input editable" />
		<!-- Dove in lettura c'è la matita, e come la matita: solo un segno. -->
		<div class="head-actions">
			<a class="icon-action" href={cancelHref} title={t('common.cancel')}><span aria-hidden="true">✕</span><span class="visually-hidden">{t('common.cancel')}</span></a>
			<button class="icon-action save" type="submit" title={submitLabel}><span aria-hidden="true">✓</span><span class="visually-hidden">{submitLabel}</span></button>
		</div>
	</header>

	<div class="meta">
		<label class="chip">
			<span>{t('page.category')}</span>
			<select name="categoryId">
				<option value="">{t('page.noCategory')}</option>
				{#each categories as c (c.id)}
					<option value={c.id} selected={values.categoryId === c.id}>{c.label}</option>
				{/each}
			</select>
		</label>
		<label class="chip grow">
			<span>{t('page.tags')}</span>
			<input name="tags" type="text" value={values.tags} title={t('page.tagsHint')} placeholder={t('page.tagsHint')} list="known-tags" autocomplete="off" />
		</label>
		<datalist id="known-tags">
			{#each knownTags as tag (tag)}<option value={tag}></option>{/each}
		</datalist>
		{#if canManage}
			<fieldset class="chip visibility">
				<legend class="visually-hidden">{t('page.visibility')}</legend>
				{#each visibilities as v (v)}
					<label title={t('visibility.' + v + 'Hint')}>
						<input type="radio" name="visibility" value={v} checked={values.visibility === v} />
						<span>{t('visibility.' + v)}</span>
					</label>
				{/each}
			</fieldset>
			<label class="chip">
				<input type="checkbox" name="playersCanEdit" checked={values.playersCanEdit} />
				<span>{t('page.playersCanEdit')}</span>
			</label>
		{:else}
			<input type="hidden" name="visibility" value={values.visibility} />
			{#if values.playersCanEdit}<input type="hidden" name="playersCanEdit" value="on" />{/if}
		{/if}
	</div>

	<div class="body">
		<div class="side">
			<SideColumn fields={values.fields} fixed={!!values.session}>
				{#if values.session}
					<fieldset class="session">
						<legend>{t('session.title')}</legend>
						<input type="hidden" name="isSession" value="1" />
						<div class="field">
							<label for="sessionNumber">{t('session.number')}</label>
							<input id="sessionNumber" name="sessionNumber" type="number" min="1" step="1" value={values.session.number ?? ''} />
						</div>
						<div class="field">
							<label for="sessionDate">{t('session.realDate')}</label>
							<input id="sessionDate" name="sessionDate" type="date" value={values.session.realDate ?? ''} />
						</div>
						<WorldDateInput prefix="sessionWorld" {months} value={values.session.world} legend={t('session.worldDate')} />
						<p class="hint">{t('session.hint')}</p>
					</fieldset>
				{/if}
			</SideColumn>
		</div>

		<div class="content">
			<span class="visually-hidden" id="content-label">{t('page.content')}</span>
			<span class="visually-hidden" id="content-hint">{t('editor.hint')}</span>
			<Editor content={values.content} {canSecret} labelId="content-label" describedBy="content-hint" inline />
		</div>
	</div>
</form>

<style>
	.page-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.5rem 0 0.75rem;
	}
	.head-actions {
		display: flex;
		gap: 0.25rem;
		margin-left: auto;
	}
	/* Stessa misura della matita della pagina; Salva nel colore principale. */
	.icon-action {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		min-height: 0;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		text-decoration: none;
		font: inherit;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
	}
	.icon-action.save {
		color: var(--c-primary);
		font-weight: 700;
	}
	.icon-action:hover,
	.icon-action:focus-visible {
		color: var(--c-primary);
		background: var(--c-surface);
	}
	/* Titolo, blocchi e riquadri: tratteggiati finché non ci si scrive dentro. */
	.title-input {
		flex: 1 1 16rem;
		min-width: 0;
		font-family: var(--font-head);
		font-size: var(--fs-2xl);
		font-weight: 700;
		letter-spacing: -0.015em;
		border: 0;
		background: none;
		padding: 0.1rem 0.35rem;
		outline: 1px dashed var(--c-border);
	}
	.title-input:hover {
		background: var(--c-surface);
	}
	.title-input:focus {
		outline: 2px solid var(--c-primary);
		background: var(--c-surface);
	}
	.icon-pick {
		position: relative;
	}
	.icon-pick summary {
		list-style: none;
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		font-size: 1.4rem;
		border: 1px dashed var(--c-border);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.icon-pick summary::-webkit-details-marker {
		display: none;
	}
	.icon-pick[open] summary,
	.icon-pick summary:hover {
		border-color: var(--c-primary);
		background: var(--c-surface);
	}
	.icons {
		position: absolute;
		z-index: 10;
		top: calc(100% + 0.25rem);
		left: 0;
		display: grid;
		grid-template-columns: repeat(8, 2.25rem);
		gap: 0.25rem;
		margin: 0;
		padding: 0.5rem;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.2);
	}
	.icon-choice {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		font-size: 1.15rem;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.icon-pick svg {
		width: 1.25rem;
		height: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon-pick summary svg {
		width: 1.5rem;
		height: 1.5rem;
	}
	.icon-choice input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	.icon-choice:hover {
		background: var(--c-surface2);
	}
	.icon-choice:has(input:checked) {
		border-color: var(--c-primary);
		box-shadow: inset 0 0 0 1px var(--c-primary);
		background: var(--c-surface2);
	}
	.icon-choice:has(input:focus-visible) {
		outline: 2px solid var(--c-primary);
		outline-offset: 2px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		font-size: var(--fs-sm);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		padding: 0.15rem 0.5rem;
		border: 1px dashed var(--c-border);
		border-radius: var(--radius);
		font-weight: 400;
		color: var(--c-muted);
	}
	.chip:focus-within {
		border: 1px solid var(--c-primary);
	}
	.chip.grow {
		flex: 1 1 14rem;
	}
	.chip select,
	.chip input[type='text'] {
		font-size: var(--fs-sm);
		min-height: 2rem;
		padding: 0.15rem 0.3rem;
		border: 0;
		background-color: transparent;
		color: var(--c-text);
	}
	/* Spazio per la freccia disegnata in app.css. */
	.chip select {
		padding-right: 1.75rem;
	}
	.chip input[type='text'] {
		flex: 1;
		min-width: 0;
	}
	/* I fieldset non vanno a capo da soli: senza questo escono dallo schermo del telefono. */
	.visibility {
		flex-wrap: wrap;
		min-width: 0;
		max-width: 100%;
	}
	.visibility label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 400;
		color: var(--c-text);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius);
		cursor: pointer;
	}
	.visibility label:has(input:checked) {
		background: var(--c-surface2);
		font-weight: 700;
	}
	/* Come la pagina: testo a sinistra, colonna a destra (o solo il «+» per aggiungerla). */
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 1.5rem 2rem;
		margin: 1.5rem 0 2rem;
	}
	.content {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
	}
	.side {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		min-width: 0;
	}
	.session {
		margin: 0;
	}
	@container (max-width: 44rem) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			grid-column: 1;
			align-items: stretch;
		}
		/* Sul telefono il «+» resta a destra, sopra il testo. */
		.side > :global(.open) {
			align-self: flex-end;
		}
		.content {
			grid-row: 2;
		}
	}
</style>
