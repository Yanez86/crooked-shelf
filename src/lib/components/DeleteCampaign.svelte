<script lang="ts">
	import { getT } from '../i18n/index.ts';

	let { id, name }: { id: number; name: string } = $props();
	const t = getT();
</script>

<details class="card delete">
	<summary>{t('campaign.delete')}<span class="visually-hidden"> {name}</span></summary>
	<p>{t('campaign.deleteWarning')}</p>
	<!-- _top: anche dal popup, per non lasciare sotto la pagina di una campagna che non c'è più. -->
	<form method="post" action="?/delete" target="_top">
		<input type="hidden" name="id" value={id} />
		<div class="field">
			<label for="delete-{id}">{t('campaign.deleteConfirm', { name })}</label>
			<input id="delete-{id}" name="confirm" type="text" required maxlength="80" autocomplete="off" />
		</div>
		<button class="btn btn-danger" type="submit">{t('campaign.deleteSubmit')}<span class="visually-hidden"> {name}</span></button>
	</form>
</details>

<style>
	summary {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--c-danger);
		font-weight: 700;
		cursor: pointer;
	}
</style>
