<script lang="ts">
	import { HEX_SHAPE, glyphTransform, hatchPath, type HexOrientation } from '../hex.ts';

	/**
	 * Un esagono da solo (tavolozza, legenda, impostazioni, scheda dell'esagono). È decorativo: il nome del terreno
	 * va scritto accanto. `overlay` mostra com'è un esagono intravisto o nascosto.
	 */
	let {
		fill,
		ink,
		glyph = '',
		fallback = false,
		orientation = 'flat',
		width = 30,
		overlay = 'none'
	}: {
		fill: string;
		ink: string;
		glyph?: string;
		fallback?: boolean;
		orientation?: HexOrientation;
		width?: number;
		overlay?: 'none' | 'glimpsed' | 'hidden';
	} = $props();

	const shape = $derived(HEX_SHAPE[orientation]);
	const height = $derived(orientation === 'flat' ? (width * 86.6) / 100 : (width * 100) / 86.6);
</script>

<!-- Ritagliato a esagono: il tratteggio non esce dai lati. -->
<svg class="hex-tile" viewBox={shape.viewBox} {width} {height} style="clip-path: {shape.clip}" aria-hidden="true" focusable="false">
	<polygon points={shape.points} {fill} class="cell" class:fallback />
	{#if glyph}<path d={glyph} stroke={ink} transform={glyphTransform(shape.center[0], shape.center[1], 2.6)} class="glyph" />{/if}
	{#if overlay === 'hidden'}
		<polygon points={shape.points} class="fog" />
		<path d={hatchPath(orientation)} class="hatch" />
	{:else if overlay === 'glimpsed'}
		<polygon points={shape.inset} class="dots" />
	{/if}
</svg>

<style>
	.hex-tile {
		flex: 0 0 auto;
	}
	.cell {
		stroke: #16181d;
		stroke-opacity: 0.4;
		stroke-width: 1px;
		vector-effect: non-scaling-stroke;
	}
	.fallback {
		stroke: #3d4350;
		stroke-opacity: 1;
		stroke-dasharray: 3 2;
	}
	.glyph {
		fill: none;
		stroke-width: 1.4px;
		vector-effect: non-scaling-stroke;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.fog {
		fill: #ffffff;
		fill-opacity: 0.55;
	}
	.hatch {
		fill: none;
		stroke: #555b69;
		stroke-width: 1px;
		vector-effect: non-scaling-stroke;
	}
	.dots {
		fill: none;
		stroke: #16181d;
		stroke-width: 2px;
		stroke-dasharray: 0.1 3.5;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
</style>
