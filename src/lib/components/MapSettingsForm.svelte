<script lang="ts">
	import { getT } from '../i18n/index.ts';

	let {
		values,
		parents,
		requireImage,
		submitLabel,
		cancelHref
	}: {
		values: { title: string; description: string; visibility: string; parentId: number | null; across: string; unit: string };
		parents: { id: number; title: string }[];
		requireImage: boolean;
		submitLabel: string;
		cancelHref: string;
	} = $props();
	const t = getT();
</script>

<form method="post" action="?/save" enctype="multipart/form-data">
	<div class="field">
		<label for="title">{t('page.title')}</label>
		<input id="title" name="title" type="text" required maxlength="120" value={values.title} />
	</div>
	<div class="field">
		<label for="image">{requireImage ? t('maps.image') : t('maps.replaceImage')}</label>
		<input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required={requireImage} aria-describedby="image-hint" />
		<span id="image-hint" class="hint">{t('maps.imageHint')}</span>
	</div>
	<div class="field">
		<label for="description">{t('common.description')}</label>
		<textarea id="description" name="description" rows="3" maxlength="1000">{values.description}</textarea>
	</div>
	<div class="field">
		<label for="parentId">{t('maps.parent')}</label>
		<select id="parentId" name="parentId" aria-describedby="parent-hint">
			<option value="">{t('maps.noParent')}</option>
			{#each parents as p (p.id)}<option value={p.id} selected={values.parentId === p.id}>{p.title}</option>{/each}
		</select>
		<span id="parent-hint" class="hint">{t('maps.parentHint')}</span>
	</div>
	<fieldset>
		<legend>{t('maps.scale')}</legend>
		<p class="hint">{t('maps.scaleHint')}</p>
		<div class="row">
			<div class="field">
				<label for="across">{t('maps.across')}</label>
				<input id="across" name="across" type="text" inputmode="decimal" value={values.across} />
			</div>
			<div class="field">
				<label for="unit">{t('maps.unit')}</label>
				<input id="unit" name="unit" type="text" maxlength="20" value={values.unit} placeholder="km" />
			</div>
		</div>
	</fieldset>
	<fieldset>
		<legend>{t('page.visibility')}</legend>
		{#each ['public', 'players', 'master'] as v (v)}
			<label class="choice">
				<input type="radio" name="visibility" value={v} checked={values.visibility === v} />
				<span>{t('visibility.' + v)}</span>
			</label>
		{/each}
	</fieldset>
	<div class="actions">
		<button class="btn btn-primary" type="submit">{submitLabel}</button>
		<a class="btn" href={cancelHref}>{t('common.cancel')}</a>
	</div>
</form>

<style>
	form {
		max-width: 44rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
	}
	.row input {
		width: 10rem;
	}
</style>
