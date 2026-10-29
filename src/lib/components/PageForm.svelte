<script lang="ts">
	import Editor from '../editor/Editor.svelte';
	import FieldsEditor from './FieldsEditor.svelte';
	import WorldDateInput from './WorldDateInput.svelte';
	import type { CalMonth } from '../calendar.ts';
	import { getT } from '../i18n/index.ts';
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
</script>

<form method="post" action="?/save" class="page-form">
	{#if updatedAt}<input type="hidden" name="updatedAt" value={updatedAt} />{/if}
	{#if values.slug}<input type="hidden" name="slug" value={values.slug} />{/if}
	{#if values.template}<input type="hidden" name="template" value={values.template} />{/if}

	<div class="field">
		<label for="title">{t('page.title')}</label>
		<input id="title" name="title" type="text" required maxlength="200" value={values.title} class="title-input" />
	</div>

	{#if values.session}
		<fieldset>
			<legend>{t('session.title')}</legend>
			<input type="hidden" name="isSession" value="1" />
			<div class="cols">
				<div class="field">
					<label for="sessionNumber">{t('session.number')}</label>
					<input id="sessionNumber" name="sessionNumber" type="number" min="1" step="1" value={values.session.number ?? ''} />
				</div>
				<div class="field">
					<label for="sessionDate">{t('session.realDate')}</label>
					<input id="sessionDate" name="sessionDate" type="date" value={values.session.realDate ?? ''} />
				</div>
			</div>
			<WorldDateInput prefix="sessionWorld" {months} value={values.session.world} legend={t('session.worldDate')} />
			<p class="hint">{t('session.hint')}</p>
		</fieldset>
	{/if}

	<FieldsEditor fields={values.fields} />

	<div class="field">
		<span class="label" id="content-label">{t('page.content')}</span>
		<span id="content-hint" class="hint">{t('editor.hint')}</span>
		<Editor content={values.content} {canSecret} labelId="content-label" describedBy="content-hint" />
	</div>

	<div class="cols">
		<div class="field">
			<label for="categoryId">{t('page.category')}</label>
			<select id="categoryId" name="categoryId">
				<option value="">{t('page.noCategory')}</option>
				{#each categories as c (c.id)}
					<option value={c.id} selected={values.categoryId === c.id}>{c.label}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="tags">{t('page.tags')}</label>
			<input id="tags" name="tags" type="text" value={values.tags} aria-describedby="tags-hint" list="known-tags" autocomplete="off" />
			<span id="tags-hint" class="hint">{t('page.tagsHint')}</span>
			<datalist id="known-tags">
				{#each knownTags as tag (tag)}<option value={tag}></option>{/each}
			</datalist>
		</div>
	</div>

	{#if canManage}
		<fieldset>
			<legend>{t('page.visibility')}</legend>
			{#each visibilities as v (v)}
				<label class="choice">
					<input type="radio" name="visibility" value={v} checked={values.visibility === v} />
					<span><strong>{t('visibility.' + v)}</strong> <span class="hint">— {t('visibility.' + v + 'Hint')}</span></span>
				</label>
			{/each}
		</fieldset>
		<label class="choice">
			<input type="checkbox" name="playersCanEdit" checked={values.playersCanEdit} />
			<span>{t('page.playersCanEdit')}</span>
		</label>
	{:else}
		<input type="hidden" name="visibility" value={values.visibility} />
		{#if values.playersCanEdit}<input type="hidden" name="playersCanEdit" value="on" />{/if}
	{/if}

	<div class="actions">
		<button class="btn btn-primary" type="submit">{submitLabel}</button>
		<a class="btn" href={cancelHref}>{t('common.cancel')}</a>
	</div>
</form>

<style>
	.title-input {
		font-size: var(--fs-lg);
		font-family: var(--font-head);
	}
	.label {
		font-weight: 600;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0 1.5rem;
	}
</style>
