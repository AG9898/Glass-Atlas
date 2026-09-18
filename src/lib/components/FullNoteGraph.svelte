<script lang="ts">
  import { goto } from '$app/navigation';
  import type * as D3 from 'd3';
  import type {
    PublishedGraphEdge,
    PublishedGraphNode,
    PublishedNoteGraph,
  } from '$lib/utils/note-graph';

  type Props = {
    graph: PublishedNoteGraph;
    focusSlug?: string | null;
  };

  let { graph, focusSlug = null }: Props = $props();
  let svgEl: SVGSVGElement | null = $state(null);
  let showWiki = $state(true);
  let showSemantic = $state(true);
  let applyLayers: ((wiki: boolean, semantic: boolean) => void) | null = null;

  const WIDTH = 1000;
  const HEIGHT = 650;
  const NODE_PADDING = 24;

  function seededCoordinate(slug: string, axis: 'x' | 'y'): number {
    let hash = axis === 'x' ? 2166136261 : 16777619;
    for (const character of slug) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    const normalized = (hash >>> 0) / 4294967295;
    const size = axis === 'x' ? WIDTH : HEIGHT;
    return NODE_PADDING + normalized * (size - NODE_PADDING * 2);
  }

  function toggleWiki(): void {
    showWiki = !showWiki;
    applyLayers?.(showWiki, showSemantic);
  }

  function toggleSemantic(): void {
    showSemantic = !showSemantic;
    applyLayers?.(showWiki, showSemantic);
  }

  $effect(() => {
    const el = svgEl;
    const graphData = graph;
    const focusedSlug = focusSlug;
    if (!el || graphData.nodes.length === 0) return;

    let simulation: D3.Simulation<D3.SimulationNodeDatum, undefined> | null = null;
    let clearZoom: (() => void) | null = null;
    let fitTimer: number | null = null;
    let cancelled = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('d3').then((d3) => {
      if (cancelled) return;
      const svg = d3.select(el).attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
      svg.selectAll('*').remove();

      type SimNode = PublishedGraphNode & D3.SimulationNodeDatum;
      type SimLink = D3.SimulationLinkDatum<SimNode> & PublishedGraphEdge;

      const nodes: SimNode[] = graphData.nodes.map((node) => ({
        ...node,
        x: node.slug === focusedSlug ? WIDTH / 2 : seededCoordinate(node.slug, 'x'),
        y: node.slug === focusedSlug ? HEIGHT / 2 : seededCoordinate(node.slug, 'y'),
        fx: node.slug === focusedSlug ? WIDTH / 2 : null,
        fy: node.slug === focusedSlug ? HEIGHT / 2 : null,
      }));
      const links: SimLink[] = graphData.edges.map((edge) => ({ ...edge }));
      let visibleLinks = links.filter(
        (edge) =>
          (edge.type === 'wiki' && showWiki) ||
          (edge.type === 'semantic' && showSemantic),
      );

      const viewport = svg.append('g').attr('class', 'full-graph-viewport');
      const linkSelection = viewport
        .append('g')
        .attr('class', 'full-graph-links')
        .selectAll<SVGLineElement, SimLink>('line')
        .data(links)
        .join('line')
        .attr('class', (edge) => `full-graph-link full-graph-link--${edge.type}`);

      const linkForce = d3
        .forceLink<SimNode, SimLink>(visibleLinks)
        .id((node) => node.slug)
        .distance((edge) => (edge.type === 'wiki' ? 120 : 165))
        .strength((edge) => (edge.type === 'wiki' ? 0.65 : 0.24));

      const forceSimulation = d3
        .forceSimulation<SimNode>(nodes)
        .force('link', linkForce)
        .force('charge', d3.forceManyBody<SimNode>().strength(-250))
        .force('center', d3.forceCenter<SimNode>(WIDTH / 2, HEIGHT / 2))
        .force('collision', d3.forceCollide<SimNode>(32))
        .velocityDecay(0.42);
      simulation = forceSimulation as unknown as D3.Simulation<
        D3.SimulationNodeDatum,
        undefined
      >;

      const endpointSlug = (endpoint: string | number | SimNode): string =>
        typeof endpoint === 'object' ? endpoint.slug : String(endpoint);

      const linkTouches = (edge: SimLink, slug: string): boolean =>
        endpointSlug(edge.source) === slug || endpointSlug(edge.target) === slug;

      const neighborsOf = (slug: string): Set<string> => {
        const neighbors = new Set<string>([slug]);
        for (const edge of visibleLinks) {
          const source = endpointSlug(edge.source);
          const target = endpointSlug(edge.target);
          if (source === slug) neighbors.add(target);
          if (target === slug) neighbors.add(source);
        }
        return neighbors;
      };

      const draggedSlugs = new Set<string>();
      const nodeSelection = viewport
        .append('g')
        .attr('class', 'full-graph-nodes')
        .selectAll<SVGGElement, SimNode>('g')
        .data(nodes)
        .join('g')
        .attr(
          'class',
          (node) =>
            `full-graph-node${node.slug === focusedSlug ? ' full-graph-node--origin' : ''}`,
        )
        .attr('role', 'link')
        .attr('tabindex', 0)
        .attr('aria-label', (node) => `Open note: ${node.title}`)
        .on('click', (_, node) => {
          if (draggedSlugs.delete(node.slug)) return;
          goto(`/notes/${node.slug}`);
        })
        .on('keydown', (event, node) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          goto(`/notes/${node.slug}`);
        })
        .on('mouseenter', (_, node) => {
          const neighbors = neighborsOf(node.slug);
          nodeSelection.classed('is-dimmed', (candidate) => !neighbors.has(candidate.slug));
          nodeSelection.classed('is-focused', (candidate) => candidate.slug === node.slug);
          linkSelection.classed('is-dimmed', (edge) => !linkTouches(edge, node.slug));
          linkSelection.classed('is-active', (edge) => linkTouches(edge, node.slug));
        })
        .on('mouseleave', () => {
          nodeSelection.classed('is-dimmed', false).classed('is-focused', false);
          linkSelection.classed('is-dimmed', false).classed('is-active', false);
        });

      nodeSelection
        .append('circle')
        .attr('class', 'full-graph-node-circle')
        .attr('r', (node) => (node.slug === focusedSlug ? 10 : 7));

      nodeSelection.append('title').text((node) =>
        node.category ? `${node.title} — ${node.category}` : node.title,
      );

      nodeSelection
        .append('text')
        .attr('class', 'full-graph-node-label')
        .attr('x', (node) => (node.slug === focusedSlug ? 15 : 12))
        .attr('dy', '0.35em')
        .text((node) => (node.title.length > 24 ? `${node.title.slice(0, 24)}…` : node.title));

      const renderPositions = () => {
        for (const node of nodes) {
          node.x = Math.max(NODE_PADDING, Math.min(WIDTH - NODE_PADDING, node.x ?? WIDTH / 2));
          node.y = Math.max(NODE_PADDING, Math.min(HEIGHT - NODE_PADDING, node.y ?? HEIGHT / 2));
        }

        linkSelection
          .attr('x1', (edge) => (edge.source as SimNode).x ?? 0)
          .attr('y1', (edge) => (edge.source as SimNode).y ?? 0)
          .attr('x2', (edge) => (edge.target as SimNode).x ?? 0)
          .attr('y2', (edge) => (edge.target as SimNode).y ?? 0);
        nodeSelection.attr('transform', (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
      };

      const convergeAndRender = () => {
        forceSimulation.stop();
        const tickCount = Math.ceil(
          Math.log(forceSimulation.alphaMin()) /
            Math.log(1 - forceSimulation.alphaDecay()),
        );
        for (let index = 0; index < tickCount; index += 1) forceSimulation.tick();
        renderPositions();
      };

      const nodeDrag = d3
        .drag<SVGGElement, SimNode>()
        .clickDistance(4)
        .on('start', (event, node) => {
          node.fx = node.x;
          node.fy = node.y;
          if (!reduceMotion && !event.active) forceSimulation.alphaTarget(0.25).restart();
        })
        .on('drag', (event, node) => {
          draggedSlugs.add(node.slug);
          const x = Math.max(NODE_PADDING, Math.min(WIDTH - NODE_PADDING, event.x));
          const y = Math.max(NODE_PADDING, Math.min(HEIGHT - NODE_PADDING, event.y));
          node.fx = x;
          node.fy = y;
          if (reduceMotion) {
            node.x = x;
            node.y = y;
            renderPositions();
          }
        })
        .on('end', (event, node) => {
          if (!reduceMotion) {
            if (!event.active) forceSimulation.alphaTarget(0);
            node.fx = null;
            node.fy = null;
          }
          window.setTimeout(() => draggedSlugs.delete(node.slug), 250);
        });
      nodeSelection.call(nodeDrag);

      const d3Zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on('zoom', (event) => viewport.attr('transform', event.transform.toString()));
      svg.call(d3Zoom).on('dblclick.zoom', null);
      clearZoom = () => svg.on('.zoom', null);

      const fitGraph = () => {
        const xValues = nodes.map((node) => node.x ?? WIDTH / 2);
        const yValues = nodes.map((node) => node.y ?? HEIGHT / 2);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const contentWidth = Math.max(1, maxX - minX);
        const contentHeight = Math.max(1, maxY - minY);
        const padding = 150;
        const scale = Math.min(
          1.8,
          WIDTH / (contentWidth + padding),
          HEIGHT / (contentHeight + padding),
        );
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const transform = d3.zoomIdentity
          .translate(WIDTH / 2 - centerX * scale, HEIGHT / 2 - centerY * scale)
          .scale(scale);
        svg.call(d3Zoom.transform, transform);
      };

      const updateLayers = (wiki: boolean, semantic: boolean) => {
        visibleLinks = links.filter(
          (edge) => (edge.type === 'wiki' && wiki) || (edge.type === 'semantic' && semantic),
        );
        linkSelection.attr('display', (edge) =>
          (edge.type === 'wiki' && wiki) || (edge.type === 'semantic' && semantic)
            ? null
            : 'none',
        );
        linkForce.links(visibleLinks);
        if (reduceMotion) {
          forceSimulation.alpha(0.35);
          convergeAndRender();
        } else {
          forceSimulation.alpha(0.45).restart();
        }
      };
      applyLayers = updateLayers;
      updateLayers(showWiki, showSemantic);

      if (reduceMotion) {
        convergeAndRender();
        fitGraph();
      } else {
        forceSimulation.on('tick', renderPositions);
        fitTimer = window.setTimeout(fitGraph, 650);
      }
    });

    return () => {
      cancelled = true;
      applyLayers = null;
      simulation?.stop();
      clearZoom?.();
      if (fitTimer !== null) window.clearTimeout(fitTimer);
    };
  });
</script>

<section class="full-note-graph" aria-label="Published note graph">
  <div class="full-note-graph__legend" aria-label="Graph relationship layers">
    <button
      type="button"
      class="full-note-graph__layer full-note-graph__layer--wiki"
      class:is-disabled={!showWiki}
      aria-pressed={showWiki}
      onclick={toggleWiki}
    >
      <span class="full-note-graph__line full-note-graph__line--wiki"></span>
      Authored links
    </button>
    <button
      type="button"
      class="full-note-graph__layer full-note-graph__layer--semantic"
      class:is-disabled={!showSemantic}
      aria-pressed={showSemantic}
      onclick={toggleSemantic}
    >
      <span class="full-note-graph__line full-note-graph__line--semantic"></span>
      Semantic similarity
    </button>
  </div>

  <div class="full-note-graph__canvas">
    {#if graph.nodes.length > 0}
      <svg
        bind:this={svgEl}
        width="100%"
        height="100%"
        role="group"
        aria-label="Interactive graph of published notes. Drag nodes, pan the background, or zoom with the mouse wheel or pinch gesture."
      ></svg>
    {:else}
      <p class="full-note-graph__empty">No published notes yet.</p>
    {/if}
  </div>
</section>

<style>
  .full-note-graph {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-block-size: 28rem;
    block-size: 100%;
    border: var(--line-std) solid var(--color-line-3);
    background: var(--color-surface-1);
  }

  .full-note-graph__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.65rem 0.8rem;
    border-bottom: var(--line-thin) solid var(--color-line-2);
  }

  .full-note-graph__layer {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: var(--line-thin) solid var(--color-line-2);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-strong);
    padding: 0.35rem 0.55rem;
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .full-note-graph__layer:hover,
  .full-note-graph__layer:focus-visible {
    border-color: var(--color-line-3);
  }

  .full-note-graph__layer:focus-visible {
    outline: var(--line-std) solid var(--color-accent-700);
    outline-offset: 2px;
  }

  .full-note-graph__layer.is-disabled {
    color: var(--color-text-muted);
    opacity: 0.48;
  }

  .full-note-graph__line {
    display: inline-block;
    inline-size: 1.7rem;
    block-size: 0;
    border-top: 2px solid var(--color-accent-700);
  }

  .full-note-graph__line--semantic {
    border-top: 1px dashed var(--color-accent2-700);
  }

  .full-note-graph__canvas {
    position: relative;
    min-block-size: 0;
    overflow: hidden;
  }

  svg {
    display: block;
    cursor: grab;
    touch-action: none;
  }

  svg:active {
    cursor: grabbing;
  }

  :global(.full-graph-link) {
    transition: stroke-opacity 0.18s ease, stroke-width 0.18s ease;
  }

  :global(.full-graph-link--wiki) {
    stroke: var(--color-accent-700);
    stroke-width: 1.8px;
    stroke-opacity: 0.72;
  }

  :global(.full-graph-link--semantic) {
    stroke: var(--color-accent2-700);
    stroke-width: 1px;
    stroke-opacity: 0.48;
    stroke-dasharray: 6 5;
  }

  :global(.full-graph-link.is-dimmed) {
    stroke-opacity: 0.08;
  }

  :global(.full-graph-link.is-active) {
    stroke-opacity: 1;
    stroke-width: 2.4px;
  }

  :global(.full-graph-node) {
    cursor: pointer;
    transition: opacity 0.18s ease;
  }

  :global(.full-graph-node-circle) {
    fill: var(--color-surface-2);
    stroke: var(--color-line-3);
    stroke-width: 1.5px;
    transition: r 0.18s ease, stroke-width 0.18s ease, fill 0.18s ease;
  }

  :global(.full-graph-node--origin .full-graph-node-circle) {
    fill: var(--color-accent-700);
    stroke: var(--color-accent-900);
    stroke-width: 3px;
  }

  :global(.full-graph-node.is-focused .full-graph-node-circle) {
    r: 11;
    fill: var(--color-accent-500);
  }

  :global(.full-graph-node.is-dimmed) {
    opacity: 0.24;
  }

  :global(.full-graph-node:focus-visible) {
    outline: none;
  }

  :global(.full-graph-node:focus-visible .full-graph-node-circle) {
    stroke: var(--color-accent-900);
    stroke-width: 3px;
  }

  :global(.full-graph-node-label) {
    fill: var(--color-text-strong);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 12px;
    font-weight: 600;
    pointer-events: none;
  }

  .full-note-graph__empty {
    margin: 0;
    padding: 2rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.full-graph-link),
    :global(.full-graph-node),
    :global(.full-graph-node-circle) {
      transition: none;
    }
  }

  @media (max-width: 640px) {
    .full-note-graph {
      min-block-size: 24rem;
    }

    .full-note-graph__legend {
      align-items: stretch;
    }

    .full-note-graph__layer {
      flex: 1;
      justify-content: center;
      min-inline-size: 9rem;
    }
  }
</style>
