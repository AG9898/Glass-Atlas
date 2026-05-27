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

    import('d3').then((d3) => {
      d3.select(el).selectAll('*').remove();

      type SimNode = GraphNode & D3.SimulationNodeDatum;

      const nodes: SimNode[] = graph.nodes.map((n) => ({
        ...n,
        x: WIDTH / 2,
        y: HEIGHT / 2,
      }));
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
        .force('collision', d3.forceCollide<SimNode>(14));

      sim = simulation as unknown as D3.Simulation<D3.SimulationNodeDatum, undefined>;

      const svg = d3.select(el).attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);

      const linkSel = svg
        .append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', 'var(--color-line-2)')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.55);

      const nodeGroup = svg
        .append('g')
        .selectAll<SVGGElement, SimNode>('g')
        .data(nodes)
        .join('g')
        .style('cursor', (d) => (d.isCurrent ? 'default' : 'pointer'))
        .on('click', (_, d) => {
          if (!d.isCurrent) goto(`/notes/${d.slug}`);
        });

      nodeGroup
        .append('circle')
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

      simulation.on('tick', () => {
        linkSel
          .attr('x1', (d) => (d.source as SimNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimNode).y ?? 0);

        nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });
    });

    return () => {
      sim?.stop();
    };
  });
</script>

{#if graph.nodes.length > 1}
  <svg
    bind:this={svgEl}
    width="100%"
    height={HEIGHT}
    aria-label="Note connections graph"
    role="img"
  ></svg>
{:else}
  <p class="graph-empty">No connections yet</p>
{/if}

<style>
  svg {
    display: block;
    overflow: visible;
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
