<script lang="ts">
	import { iconPath } from '../icons.ts';

	/** Icona a tratto, decorativa: il nome dell'azione va scritto accanto o nell'etichetta del pulsante. */
	let { name }: { name: string } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={iconPath(name)} /></svg>
