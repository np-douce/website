# NP-douce 1.2

**NP-douce** is an experimental research application for exploring combinatorial optimization problems using ideas from statistical mechanics, exact combinatorial counting, and constrained solution-space analysis.

Open `index.html` in a browser to run the app.

The app is static: it uses only local HTML, CSS, and JavaScript. No server is required for desktop use.

## Included tools

- 3-SAT to classic Vertex Cover to direct Hamiltonian-cycle reduction
- Vertex Cover to direct 12-node-gadget Hamiltonian-cycle reduction
- Clique to Vertex Cover complement to direct 12-node-gadget Hamiltonian-cycle reduction
- Independent Set to Vertex Cover to direct 12-node-gadget Hamiltonian-cycle reduction
- Set Cover to 3-SAT to Vertex Cover to direct Hamiltonian-cycle reduction
- X3C to 3-SAT to Vertex Cover to direct Hamiltonian-cycle reduction
- Graph Coloring to 3-SAT to Vertex Cover to direct Hamiltonian-cycle reduction
- Hamiltonian pairs input
- TSP matrix input
- TSP Euclidean points input
- TSP manual upper-triangle edge input

## Core theory

NP-douce studies NP-complete problems by reducing them to Hamiltonian Cycle, then scoring Hamiltonian choices using state counts, mean tour weight, variance, and an approximate partition function.

For a complete weighted graph with $n$ vertices, the number of undirected Hamiltonian cycles is:

```math
\Omega_0 = \frac{(n - 1)!}{2}
```

If $W$ is the sum of all edge weights, the exact average tour weight is:

```math
\mu = \frac{2W}{n - 1}
```

The variance uses edge-pair counting instead of tour enumeration. Here $S_2$ is the sum of squared edge weights, $A$ is the sum over edge pairs that share a vertex, and $D$ is the sum over disjoint edge pairs:

```math
\sigma^2 =
\frac{2}{n - 1}S_2
+ \frac{4}{(n - 1)(n - 2)}(A + 2D)
- \mu^2
```

After some edges are committed, the app recomputes the same kind of statistics for the constrained Hamiltonian ensemble. Let $Q_C$ be the total weight already committed, $q_C$ be the number of open committed path components, and $V_C$ be the vertices touched by those components. The remaining completion factor is:

```math
r_C = n - 1 + q_C - |V_C|
```

The constrained count is:

```math
\Omega_C = 2^{q_C - 1}r_C!
```

The count entropy is:

```math
S_C = \ln \Omega_C
```

The app divides remaining candidate edges into three buckets:

- $OO$: open endpoint to open endpoint
- $OF$: open endpoint to free vertex
- $FF$: free vertex to free vertex

Let $B_{OO}$, $B_{OF}$, and $B_{FF}$ be the weight sums in those buckets. Let $B_{OO}^{(2)}$, $B_{OF}^{(2)}$, and $B_{FF}^{(2)}$ be the squared-weight sums. The constrained mean used by the solver is:

```math
\mu_C =
Q_C
+ \frac{1}{2r_C}B_{OO}
+ \frac{1}{r_C}B_{OF}
+ \frac{2}{r_C}B_{FF}
```

For the constrained variance, the app uses the same idea as the general variance formula, but with pair buckets that respect the already committed chains. Let:

```math
R_C =
\frac{1}{2}P_{OO}
+ P_{OF,T}
+ 2P_{OF,D}
+ 4P_{FF,T}
+ 8P_{FF,D}
+ P_{OO,OF,T}
+ 2P_{OO,FF}
+ 2P_{OF,FF,T}
+ 4P_{OF,FF,D}
```

Each $P$ term is a sum of products $w_e w_f$ over compatible unordered edge pairs. $T$ means the two edges touch, and $D$ means they are disjoint. For example, $P_{OF,T}$ is the touching-pair sum for two open-free edges, $P_{FF,D}$ is the disjoint-pair sum for two free-free edges, and $P_{OF,FF,T}$ is the touching-pair sum for one open-free edge paired with one free-free edge. These are the constrained versions of the general touching and disjoint pair sums. The constrained variance is:

```math
\sigma_C^2 =
\frac{1}{2r_C}B_{OO}^{(2)}
+ \frac{1}{r_C}B_{OF}^{(2)}
+ \frac{2}{r_C}B_{FF}^{(2)}
+ \frac{1}{r_C(r_C - 1)}R_C
- (\mu_C - Q_C)^2
```

The partition approximation used for scoring is:

```math
\ln Z_C(\beta) \approx \ln \Omega_C - \beta\mu_C + \frac{\beta^2\sigma_C^2}{2}
```

For a candidate edge $e$, the importance score compares choosing the edge against forbidding it:

```math
I_t(e)
=
\ln Z(CE_t \cup \{e\})
-
\ln Z(CE_t \cup \{\bar e\})
```

The app selects the highest-scoring admissible edge:

```math
e_t^* = \arg\max_{e \in A_t} I_t(e)
```

and commits it:

```math
CE_{t+1} = CE_t \cup \{e_t^*\}
```

For reduction tabs, the final Hamiltonian witness is translated back into the original problem. For example, a Clique reduction displays the inferred clique, not just an HC tour.

## Conceptual flow

```text
NP-complete problem
      |
      v
Polynomial-time reduction to Hamiltonian Cycle
      |
      v
Exact combinatorial counting
      |
      v
State count, mean, variance
      |
      v
Approximate ln Z
      |
      v
Candidate-edge importance
      |
      v
Iterative edge or witness selection
      |
      v
Hamiltonian tour or inferred original-problem answer
```

## Math note

The Hamiltonian/TSP theory calculations are ported from the C++ formulas using JavaScript `Number`, which is IEEE-754 double precision like C++ `double`.

Large Hamiltonian graphs can still be expensive because the original theory includes nested pair/edge calculations. Matrix, points, manual, and pair inputs do not have a fixed app maximum; their practical size depends on the input and the device running the browser.

Reduction tabs now use this strict flow for their displayed answer:

```text
original problem -> reduction -> HC graph -> NP-douce HC solver -> inferred original answer
```

When the HC solver returns YES, reduction tabs print concrete original-problem witnesses, such as SAT assignments, vertex covers, cliques, independent sets, selected sets, or colorings. The displayed witness count is capped by `HC backtrack tries`. Raw HC and TSP-style tabs also print the best tour order, not just the tour weight. The app screen is compacted to the final answer, witness lines, node counts, key run settings, and elapsed time instead of the full solver trace. Verbose preambles, hidden edge/formula manifests, and duplicate display-only prechecks are skipped so compact runs do less formatting work.

The raw Hamiltonian Pairs tab keeps scoring restricted to real `-1` HC edges. Before scoring, it applies only necessary HC facts: every vertex must have at least two usable HC edges, the usable graph must be connected, and the usable graph cannot have a bridge or articulation point. Degree-2 vertices are forced before the score search. Backtracking skips raw HC branches that collapse to the same forced-edge state.

The TSP Points tab keeps the same score-guided method, then applies the Euclidean no-crossing fact to remove crossing edges from a completed points tour. Matrix and manual TSP inputs are not given Euclidean crossing rules.

If the reduced HC graph is above the app's `HC solve node limit`, the tab reports `NOT COMPUTED` instead of using a separate direct solver. Raise the limit when you want to force a larger reduced HC instance through the solver, but large values can run very slowly.

Reduction tabs run the HC solver over the full set of real allowed HC edges from the start. They still skip zero-weight non-edges, because those cannot contribute to the target `-n` Hamiltonian tour.

Before a generated 3-SAT formula is sent to Vertex Cover, reduction tabs run exact unit-clause simplification. A clause like `[-3, -3, -3]` is treated as the unit clause `~x3`, so `x3=false` is forced and satisfied clauses are removed. Binary clauses are kept during simplification, then the classic Vertex Cover clause triangle duplicates one literal when a two-literal clause must become a 3-literal triangle.

The HC solver now uses the importance score from the Core theory section automatically. The older omega-only score is no longer exposed as a setting. Adaptive beta is also automatic: each step recomputes the current conditioned standard deviation and uses it to scale the score.

Score-guided backtracking is controlled by `HC backtrack tries`, which defaults to `0`. On SAT-based reduction tabs, `0` means one greedy SAT witness branch with no saved alternatives; raising the value queues next-best witness branches. The `Search all answers` switch can either stop when the first Hamiltonian witness is accepted or keep searching all allowed tries and list distinct witnesses it finds. Matrix, points, and manual weighted tabs keep using the all-tries best-tour behavior. The global solver tuning is the HC solve node limit, `HC backtrack tries`, and the `Search all answers` switch.

Before scoring, the raw HC solver runs necessary graph checks and the original degree-2 forced-edge precheck: if a vertex has exactly two listed HC edges, both are forced into the tour before the scoring loop continues.

The TSP tabs expose the adaptive beta multiplier `c`. The production default remains `c = 1`; for the bundled TSPLIB gr17 matrix/manual examples, `c = 1.5` with `HC backtrack tries = 4` is a recommended experiment setting for reaching the known optimum tour cost `2085`. TSP repair passes are not exposed because backtracking is the smart repair path.

## 3-SAT input format

The first line is:

```text
variables clauses optional_padding_nodes
```

Each following line is one clause with three integer literals:

```text
1 -2 3
```

This means:

```text
(x1 OR ~x2 OR x3)
```

After simplification, the classic route is:

```text
3-SAT -> Vertex Cover clause triangles -> direct Vertex Cover HC gadget
```

For `V` simplified SAT variables and `C` simplified clauses:

```text
Vertex Cover vertices = 2V + 3C
Vertex Cover edges = V + 6C
Vertex Cover target k = V + 2C
estimated HC nodes = 12 * (V + 6C) + 2 * (V + 2C) + padding
```

## Vertex Cover input format

The first line is:

```text
vertices k optional_padding_nodes
```

Each following line is one undirected edge:

```text
1 2
2 3
```

The app uses the direct classic Vertex Cover to Hamiltonian Cycle construction. Each original graph edge becomes a 12-node gadget with endpoint rows and crosses `u1-v3`, `v1-u3`, `u6-v4`, and `u4-v6`. Selector slots choose up to `k` vertex paths.

Incident rows for the same original vertex are linked as `u6 -> next u1`, so the degree-2 precheck collapses most of each gadget before the remaining selector and cross edges are scored by the HC solver.

On the 3-SAT tab and the tabs that pass through generated 3-SAT, the browser now scores SAT witness choices first. For `V` checked Boolean decision variables, that means `2V` logical witness choices. Each choice is represented by a paired HC diagonal decision; either valid diagonal commits the same VC consequence, then the gadget propagation forces the paired chain. After the relevant original decision variables are committed, the tab checks the inferred original witness instead of spending time scoring unrelated HC completion edges. Set Cover and X3C check selected set variables, and Graph Coloring checks vertex-color choices.

The direct Vertex Cover tab now uses the same witness-choice pattern. For `n` original vertices, it scores `2n` logical choices: `cover(v)` and `not cover(v)`. Clique and Independent Set inherit this through their Vertex Cover reductions. After all original vertices are committed or forced, the app validates the original cover, clique, or independent set witness instead of scoring unrelated HC completion edges.

Node count for this direct reduction is roughly:

```text
undirected nodes = 12 * edges + 2 * min(k, vertices) + padding
```

## Clique input format

The first line is:

```text
vertices k optional_padding_nodes
```

Each following line is one undirected edge:

```text
1 2
1 3
2 3
```

This asks whether the graph has a clique of size at least `k`. The app uses the standard practical reduction:

```text
Clique(G, k) -> Vertex Cover(complement(G), vertices - k) -> direct 12-node-gadget Hamiltonian Cycle
```

Example:

```text
5 3
1 2
1 3
2 3
3 4
4 5
```

This example has a clique `{1, 2, 3}`. The Hamiltonian-cycle side uses the direct Vertex Cover gadget and degree-2 forced-edge precheck.

## Independent Set input format

The first line is:

```text
vertices k optional_padding_nodes
```

Each following line is one undirected edge:

```text
1 2
2 3
3 4
4 5
```

This asks whether the graph has an independent set of size at least `k`. The app uses the shorter standard reduction:

```text
Independent Set(G, k) -> Vertex Cover(G, vertices - k) -> direct 12-node-gadget Hamiltonian Cycle
```

Example:

```text
5 3
1 2
2 3
3 4
4 5
```

This example has an independent set `{1, 3, 5}`. Because this route goes directly to Vertex Cover on the same graph, it avoids an extra complement graph step before the Hamiltonian-cycle calculation.

## Set Cover input format

The first line is:

```text
universe_size set_count k optional_padding_nodes
```

Each following line is one set, written as element numbers from `1` through `universe_size`:

```text
1 2
2 3 4
4 5
1 5
```

This asks whether at most `k` sets cover every universe element. The app uses:

```text
Set Cover -> 3-SAT coverage clauses plus at-most-k -> Vertex Cover clause triangles -> direct Hamiltonian Cycle
```

Example:

```text
5 4 2
1 2
2 3 4
4 5
1 5
```

This example has a set cover `{S2, S4}`. The 3-SAT encoding uses one Boolean variable per set, one coverage clause per universe element, and the sequential counter for the at-most-`k` rule.

## X3C input format

The first line is:

```text
universe_size set_count optional_padding_nodes
```

Each following line is one 3-element set, written as element numbers from `1` through `universe_size`:

```text
1 2 3
4 5 6
1 4 5
2 3 6
```

This asks whether the universe can be covered exactly once by disjoint 3-sets. The app uses:

```text
X3C -> 3-SAT exactly-once coverage clauses -> Vertex Cover clause triangles -> direct Hamiltonian Cycle
```

Example:

```text
6 4
1 2 3
4 5 6
1 4 5
2 3 6
```

This example has an exact cover `{S1, S2}`. The 3-SAT encoding uses one Boolean variable per 3-set, one at-least-one coverage clause for each universe element, and pairwise not-both clauses for every pair of sets that share an element.

## Graph Coloring input format

The first line is:

```text
vertices edges colors optional_padding_nodes
```

Each following line is one undirected edge:

```text
1 2
2 3
3 4
4 1
```

This asks whether every vertex can be colored with the requested number of colors so that connected vertices have different colors. The app uses:

```text
Graph Coloring -> 3-SAT color clauses -> Vertex Cover clause triangles -> direct Hamiltonian Cycle
```

Example 3-colorable instance:

```text
4 4 3
1 2
2 3
3 4
4 1
```

Example 4-colorable instance:

```text
4 6 4
1 2
1 3
1 4
2 3
2 4
3 4
```

That second graph is `K4`: it is not 3-colorable, but it is 4-colorable. The 3-SAT encoding uses `colors * vertices` base variables, one at-least-one-color clause per vertex, pairwise not-both color clauses per vertex, and one conflict clause per edge per color before 3-literal normalization.

## Repository structure

The browser app is intentionally simple:

```text
index.html
app.js
styles.css
manifest.webmanifest
sw.js
np-douce-logo.png
*_input.txt
README.md
```

The `*_input.txt` files are example inputs for the problem tabs. The app is static and can run from the local folder or from GitHub Pages.

## Benchmark examples

The default examples use small benchmark or benchmark-format instances so they stay reproducible while fitting the browser solver's default `HC solve node limit` of `20000`.

| Page | Source | Instance | Size | Expected answer / optimum | Conversion notes |
| --- | --- | --- | --- | --- | --- |
| 3-SAT | SATLIB uf20-91 family, https://www.cs.ubc.ca/~hoos/SATLIB/benchm.html | uf20-01.cnf | 20 variables, 91 clauses | SAT | DIMACS trailing zeros are removed from each clause. Set `HC backtrack tries` to `2` before running this example. |
| Vertex Cover | DIMACS COLOR graph source, https://mat.gsia.cmu.edu/COLOR/instances.html | myciel3.col | 11 vertices, 20 edges, k=6 | YES; k=5 is NO | DIMACS `p/e` prefixes are removed; same edge list is used directly. |
| Clique | DIMACS COLOR graph source, https://mat.gsia.cmu.edu/COLOR/instances.html | complement of myciel3.col | 11 vertices, 35 edges, k=5 | YES; k=6 is NO | DIMACS `p/e` prefixes are removed, then the graph is complemented for the input so the clique threshold is nontrivial. |
| Independent Set | DIMACS COLOR graph source, https://mat.gsia.cmu.edu/COLOR/instances.html | myciel3.col | 11 vertices, 20 edges, k=5 | YES; k=6 is NO | DIMACS `p/e` prefixes are removed; same edge list is used directly. |
| Set Cover | Beasley OR-Library set covering reference, https://people.brunel.ac.uk/~mastjjb/jeb/orlib/scpinfo.html | small set-covering incidence example | 7 elements, 7 sets, k=3 | Optimum 3; YES for k=3 | Row/column incidence is transposed into the app's one-set-per-line format. |
| X3C | Karp exact-cover-by-3-sets problem family | canonical X3C teaching instance | 6 elements, 4 triples | YES, exact cover S1 and S2 | No tiny directly compatible library file is bundled; the current example is kept and labelled. |
| Graph Coloring | DIMACS graph-coloring edge-list format | complete bipartite graph K3,3 | 6 vertices, 9 edges, 3 colors | Chromatic number 2; YES for 3 colors | DIMACS `p/e` prefixes are removed; this graph has minimum degree 3, so it survives the exact precheck and runs through the HC witness path. |
| Hamiltonian Pairs | DIMACS COLOR graph source, https://mat.gsia.cmu.edu/COLOR/instances.html | myciel3.col as an HC graph | 11 vertices, 20 edges | YES; one cycle is 1-2-6-4-10-3-7-11-8-5-9-1 | DIMACS edge list is loaded as raw allowed Hamiltonian edges. |
| TSP Matrix | TSPLIB95, https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/ | gr17 | 17 cities | Optimum tour length 2085 | TSPLIB lower-diagonal matrix is expanded to the app's full symmetric matrix. |
| TSP Points | TSPLIB95, https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/ | burma14 | 14 coordinates | Official TSPLIB GEO optimum is not used for Euclidean app scoring | Coordinates are copied into the app's Euclidean points format. |
| TSP Manual | TSPLIB95, https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/ | gr17 | 17 cities | Optimum tour length 2085 | Same matrix as the Matrix tab, flattened into upper-triangle manual order. |

## Running the browser version

For local use, open `index.html` in a browser. For hosted use, serve the folder with GitHub Pages or any static-file server.

Because the app uses browser JavaScript, caching, and a service worker, GitHub Pages can sometimes keep older files briefly. The service worker cache name is updated when the app version changes.

## Offline support

The browser version uses a service worker to cache common app resources:

```text
manifest.webmanifest
sw.js
index.html
app.js
styles.css
np-douce-logo.png
```

Once cached, supported browsers may allow the app to keep working offline, subject to browser cache rules.

## Research status

NP-douce is an experimental research prototype and reference implementation.

The project is intended to support experimentation, verification, benchmarking, and visualization of the mathematical framework. Results from the software should be independently verified when used for formal mathematical or complexity-theoretic claims.

## Goals

The project explores whether useful global information about difficult combinatorial solution spaces can be obtained from exact combinatorial statistics.

In particular, NP-douce investigates how combinatorial counts, mean cost, variance, partition approximation, and edge importance can describe the Hamiltonian solution space and compare candidate optimization decisions across NP-complete problem classes.

## Citation

If you use this project in academic work, cite the associated paper or repository. A formal citation can be updated when final publication information is available.

```bibtex
@software{npdouce,
  author = {Michel Seraphin},
  title  = {NP-Douce},
  year   = {2026},
  note   = {Experimental research software for combinatorial optimization}
}
```

## Author

**Michel Seraphin**

Independent research in combinatorial optimization, Hamiltonian problems, and statistical-mechanical methods for discrete systems.

## Disclaimer

This repository contains experimental research software. The implementation and numerical experiments are intended for research and educational purposes. Computational demonstrations should not be construed as formal proofs of computational complexity results or polynomial-time solvability of NP-complete problems.
