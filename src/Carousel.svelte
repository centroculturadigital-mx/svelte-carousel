<script>

	import Siema from 'siema'

	import { tap } from '@sveltejs/gestures';

	import { onMount } from 'svelte'
	
	export let perPage = 3
	export let loop = true
	export let autoplay = 0
	export let go = 0

	let siema
	let controller
	let timer

	$: goTo(go)

	$: pips = controller ? controller.innerElements : []
	
	onMount(() => {
		controller = new Siema({
			selector: siema,
			perPage,
			loop
		})

		autoplay && setInterval(right, autoplay)

		return () => {
			autoplay && clearTimeout(timer)
			controller.destroy()
		}
	})
	
	function left () {
		controller.prev()
	}
	
	function right () {
		controller.next()
	}

	function goTo (index) {
		controller.goTo(index)
	}
</script>



<style>
	.carousel {
		position: relative;
		width: 100%;
		justify-content: center;
		align-items: center;
	}
	
	button {
		position: absolute;
		width: 40px;
		height: 40px;
		top: 50%;
		z-index: 50;
		margin-top: -20px;
		border: none;
		background-color: transparent;
	}

  button:focus {
    outline: none;
  }
	
	.left {
		left: 2vw;
	}
	
	.right {
		right: 2vw;
	}

	ul {
		list-style-type: none;
		position: absolute;
		display: flex;
		justify-content: center;
		width: 100%;
		margin: 1rem 0;
		padding: 0;
	}

	ul li {
		margin: .5rem;
		border-radius: 100%;
		background-color: rgba(255,255,255,0.5);
		height: 8px;
		width: 8px;
	}

	ul li:hover {
		background-color: rgba(255,255,255,0.85);
	}
</style>





<div class="carousel">
	<button class="left" use:tap on:tap={left}>
		<slot name="left-control"></slot>
	</button>
	<div class="slides" bind:this={siema}>
		<slot></slot>
	</div>
	<ul>
		{#each pips as pip, i}
		<li use:tap on:tap={() => goTo(i)}></li>
		{/each}
	</ul>
	<button class="right" use:tap on:tap={right}>
		<slot name="right-control"></slot>
	</button>
</div>