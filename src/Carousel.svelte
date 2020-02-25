<script>

	import Siema from 'siema'

	import { tap } from '@sveltejs/gestures';

	import { onMount } from 'svelte'
	
	export let perPage = 3
	export let loop = true
	export let autoplay = 0
	export let go = 0
	export let current = 0

	let id
	let siema
	let controller
	let timer

	$: goTo(go)

	$: pips = controller ? controller.innerElements : []
	
	onMount(() => {

		id = Math.ceil(Math.random() * 300000)
		const onChange  = i => { current = i }
		controller = new Siema({
			selector: siema,
			perPage,
			loop,
			onChange
		})

		 
	
			
		document.addEventListener('keydown', event => {
	
			switch(event.keyCode) {
				case 32:
					right();
					break;
				case 37:
				case 38:
					left();
					break;
				case 39:
				case 40:
					right();
					break;
			}
			
		
        });


		autoplay && setInterval(right, autoplay)

		return () => {
			autoplay && clearTimeout(timer)
			controller.destroy()
		}
	})
	
	function left () {
		current--;
		current %= pips.length
		controller.prev(1,goTo(current))
	}
	
	function right () {
		current++;
		current %= pips.length
		controller.next(1,goTo(current))
	}

	function goTo (index) {
		
		console.log("goTo?");
		

		if(!!controller&&(index===0||index>0)) {
			controller.goTo(index,()=>{ current = index })
		}
		
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

	.active {
		background-color: rgba(0,0,0,0.85);
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
		{#each pips as pip, i ("pip_"+id+"_"+i)}
			<li class={ current==i ? "active" : "" } use:tap on:tap={() => goTo(i)}></li>
		{/each}
	</ul>
	<button class="right" use:tap on:tap={right}>
		<slot name="right-control"></slot>
	</button>
</div>