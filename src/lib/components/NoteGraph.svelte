<script lang="ts">
  import { goto } from '$app/navigation';
  import type * as D3 from 'd3';

  type GraphNode = {
    slug: string;
    title: string;
    isCurrent: boolean;
  };

  type NoteGraphData = {
    nodes: GraphNode[];
    edges: { source: string; target: string }[];
  };

  type Props = {
    graph: NoteGraphData;
  };

  let { graph }: Props = $props();

  let svgEl: SVGSVGElement | null = $state(null);

  const WIDTH = 188;
  const HEIGHT = 150;

  $effect(() => {
    const el = svgEl;
    if (!el || graph.nodes.length <= 1) return;

    let sim: D3.Simulation<D3.SimulationNodeDatum, undefined> | null = null;
    let cancelled = false;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('d3').then((d3) => {
      if (cancelled) return;
      d3.select(el).selectAll('*').remove();

      type SimNode = GraphNode & D3.SimulationNodeDatum;

      const nodes: SimNode[] = graph.nodes.map((n, i) => {
        // Seed a small deterministic spread around center so the simulation
        // has somewhere to unfold from rather than every node starting stacked.
        const angle = (i / graph.nodes.length) * Math.PI * 2;
        return {
          ...n,
          x: WIDTH / 2 + Math.cos(angle) * 18,
          y: HEIGHT / 2 + Math.sin(angle) * 18,
        };
      });
      const links: D3.SimulationLinkDatum<SimNode>[] = graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
      }));

      const simulation = d3
        .forceSimulation<SimNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<SimNode, D3.SimulationLinkDatum<SimNode>>(links)
            .id((d) => d.slug)
            .distance(42),
        )
        .force('charge', d3.forceManyBody<SimNode>().strength(-85))
        .force('center', d3.forceCenter<SimNode>(WIDTH / 2, HEIGHT / 2))
        .force('collision', d3.forceCollide<SimNode>(14))
        .velocityDecay(0.45);

      sim = simulation as unknown as D3.Simulation<D3.SimulationNodeDatum, undefined>;

      const svg = d3.select(el).attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
      const viewport = svg.append('g').attr('class', 'graph-viewport');

      let panX = 0;
      let panY = 0;
      const renderPan = () => {
        viewport.attr('transform', `translate(${panX},${panY})`);
      };

      const panBehavior = d3
        .drag<SVGSVGElement, unknown>()
        .filter((event) => event.target === el && !event.ctrlKey && !event.button)
        .subject(() => ({ x: panX, y: panY }))
        .on('drag', (event) => {
          panX = Math.max(-WIDTH / 2, Math.min(WIDTH / 2, event.x));
          panY = Math.max(-HEIGHT / 2, Math.min(HEIGHT / 2, event.y));
          renderPan();
        });

      svg.call(panBehavior);

      const linkSel = viewport
        .append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', 'graph-link')
        .attr('stroke', 'var(--color-line-2)')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.55);

      const neighborsOf = (slug: string) => {
        const neighbors = new Set<string>([slug]);
        for (const l of links) {
          const s = typeof l.source === 'string' ? l.source : (l.source as SimNode).slug;
          const t = typeof l.target === 'string' ? l.target : (l.target as SimNode).slug;
          if (s === slug) neighbors.add(t);
          if (t === slug) neighbors.add(s);
        }
        return neighbors;
      };

      const linkTouches = (l: D3.SimulationLinkDatum<SimNode>, slug: string) => {
        const s = typeof l.source === 'string' ? l.source : (l.source as SimNode).slug;
        const t = typeof l.target === 'string' ? l.target : (l.target as SimNode).slug;
        return s === slug || t === slug;
      };

      const draggedSlugs = new Set<string>();

      const nodeGroup = viewport
        .append('g')
        .selectAll<SVGGElement, SimNode>('g')
        .data(nodes)
        .join('g')
        .attr('class', 'graph-node')
        .attr('role', (d) => (d.isCurrent ? 'img' : 'link'))
        .attr('tabindex', (d) => (d.isCurrent ? null : 0))
        .attr('aria-label', (d) =>
          d.isCurrent ? `Current note: ${d.title}` : `Open note: ${d.title}`,
        )
        .style('cursor', (d) => (d.isCurrent ? 'default' : 'pointer'))
        .on('click', (_, d) => {
          if (draggedSlugs.delete(d.slug)) return;
          if (!d.isCurrent) goto(`/notes/${d.slug}`);
        })
        .on('keydown', (event, d) => {
          if (!d.isCurrent && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            goto(`/notes/${d.slug}`);
          }
        })
        .on('mouseenter', function (_, d) {
          const neighbors = neighborsOf(d.slug);
          nodeGroup.classed('is-dimmed', (n) => !neighbors.has(n.slug));
          nodeGroup.classed('is-focused', (n) => n.slug === d.slug);
          linkSel.classed('is-dimmed', (l) => !linkTouches(l, d.slug));
          linkSel.classed('is-active', (l) => linkTouches(l, d.slug));
        })
        .on('mouseleave', function () {
          nodeGroup.classed('is-dimmed', false).classed('is-focused', false);
          linkSel.classed('is-dimmed', false).classed('is-active', false);
        });

      const nodeDrag = d3
        .drag<SVGGElement, SimNode>()
        .clickDistance(4)
        .on('start', (event, d) => {
          d.fx = d.x;
          d.fy = d.y;
          if (!reduceMotion && !event.active) simulation.alphaTarget(0.25).restart();
        })
        .on('drag', (event, d) => {
          draggedSlugs.add(d.slug);

          const x = Math.max(10, Math.min(WIDTH - 10, event.x));
          const y = Math.max(10, Math.min(HEIGHT - 10, event.y));
          d.fx = x;
          d.fy = y;

          if (reduceMotion) {
            d.x = x;
            d.y = y;
            renderPositions();
          }
        })
        .on('end', (event, d) => {
          if (!reduceMotion) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }
          // Chrome may dispatch the synthetic click after the drag-end task.
          // Keep the guard briefly, then clear it so a later intentional click works.
          window.setTimeout(() => draggedSlugs.delete(d.slug), 250);
        });

      nodeGroup.call(nodeDrag);

      nodeGroup
        .append('circle')
        .attr('class', 'graph-node-circle')
        .attr('r', (d) => (d.isCurrent ? 8 : 5))
        .attr('fill', (d) =>
          d.isCurrent ? 'var(--color-accent-700)' : 'var(--color-surface-2)',
        )
        .attr('stroke', (d) =>
          d.isCurrent ? 'var(--color-accent-900)' : 'var(--color-line-2)',
        )
        .attr('stroke-width', 1);

      nodeGroup.append('title').text((d) => d.title);

      nodeGroup
        .append('text')
        .text((d) => (d.title.length > 11 ? `${d.title.slice(0, 11)}…` : d.title))
        .attr('dy', '0.35em')
        .attr('x', (d) => (d.isCurrent ? 11 : 7))
        .attr('font-size', '7px')
        .attr('fill', 'var(--color-text-muted)')
        .attr('pointer-events', 'none');

      const renderPositions = () => {
        for (const node of nodes) {
          node.x = Math.max(10, Math.min(WIDTH - 10, node.x ?? WIDTH / 2));
          node.y = Math.max(10, Math.min(HEIGHT - 10, node.y ?? HEIGHT / 2));
        }

        linkSel
          .attr('x1', (d) => (d.source as SimNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimNode).y ?? 0);

        nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      };

      if (reduceMotion) {
        // Skip the animated unfold entirely: converge the layout synchronously
        // and paint the final positions once, so no motion is shown at all.
        simulation.stop();
        const tickCount = Math.ceil(
          Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
        );
        for (let i = 0; i < tickCount; i++) simulation.tick();
        renderPositions();
      } else {
        simulation.on('tick', renderPositions);
      }
    });

    return () => {
      cancelled = true;
      sim?.stop();
    };
  });
</script>

{#if graph.nodes.length > 1}
  <svg
    bind:this={svgEl}
    width="100%"
    height={HEIGHT}
    aria-label="Interactive note connections graph. Drag nodes or drag the background to pan."
    role="group"
  ></svg>
{:else}
  <p class="graph-empty">No connections yet</p>
{/if}

<style>
  svg {
    display: block;
    overflow: visible;
    cursor: grab;
    touch-action: none;
  }

  svg:active {
    cursor: grabbing;
  }

  :global(.graph-node-circle) {
    transition:
      r 0.18s ease,
      opacity 0.18s ease;
  }

  :global(.graph-link) {
    transition:
      stroke-opacity 0.18s ease,
      stroke-width 0.18s ease;
  }

  :global(.graph-node.is-focused .graph-node-circle) {
    r: 9;
  }

  :global(.graph-node:focus-visible) {
    outline: none;
  }

  :global(.graph-node:focus-visible .graph-node-circle) {
    stroke: var(--color-accent-900);
    stroke-width: 2px;
  }

  :global(.graph-node.is-dimmed) {
    opacity: 0.35;
  }

  :global(.graph-link.is-dimmed) {
    stroke-opacity: 0.15 !important;
  }

  :global(.graph-link.is-active) {
    stroke-opacity: 0.9 !important;
    stroke-width: 1.5px !important;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.graph-node-circle),
    :global(.graph-link) {
      transition: none;
    }
  }

  .graph-empty {
    margin: 0;
    padding: 0.5rem 1rem;
    color: var(--color-text-muted);
    font-family: 'Space Grotesk', 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.6rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
