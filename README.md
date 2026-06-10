# NP-douce 1.0

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
- Visual Sudoku to exact-cover 3-SAT to Vertex Cover to direct Hamiltonian-cycle reduction
- 3D truck/container packing with candidate-placement 3-SAT to Vertex Cover to HC
- Hamiltonian pairs input
- Matrix input
- Euclidean points input
- Manual upper-triangle edge input

## Math note

The Hamiltonian/TSP theory calculations are ported from the C++ formulas using JavaScript `Number`, which is IEEE-754 double precision like C++ `double`.

Large Hamiltonian graphs can still be expensive because the original theory includes nested pair/edge calculations. Matrix, points, manual, and pair inputs do not have a fixed app maximum; their practical size depends on the input and the device running the browser.

Reduction tabs now use this strict flow for their displayed answer:

```text
original problem -> reduction -> HC graph -> NP-douce HC solver -> inferred original answer
```

When the HC solver returns YES, reduction tabs print concrete original-problem witnesses, such as SAT assignments, vertex covers, cliques, independent sets, selected sets, colorings, Sudoku grids, or packing placement summaries. The displayed witness count is capped by `HC backtrack tries`. Raw HC and TSP-style tabs also print the best tour order, not just the tour weight. The app screen is compacted to the final answer, witness lines, node counts, key run settings, and elapsed time instead of the full solver trace. Verbose preambles, hidden edge/formula manifests, and duplicate display-only prechecks are skipped so compact runs do less formatting work.

If the reduced HC graph is above the app's `HC solve node limit`, the tab reports `NOT COMPUTED` instead of using a separate direct solver. Raise the limit when you want to force a larger reduced HC instance through the solver, but large values can run very slowly.

Reduction tabs run the HC solver over the full set of real allowed HC edges from the start. They still skip zero-weight non-edges, because those cannot contribute to the target `-n` Hamiltonian tour.

Before a generated 3-SAT formula is sent to Vertex Cover, reduction tabs run exact unit-clause simplification. A clause like `[-3, -3, -3]` is treated as the unit clause `~x3`, so `x3=false` is forced and satisfied clauses are removed. Binary clauses are kept during simplification, then the classic Vertex Cover clause triangle duplicates one literal when a two-literal clause must become a 3-literal triangle.

The HC solver now uses the importance score automatically: `lnZ(CE + e) - lnZ(CE without e)`. The older omega-only score is no longer exposed as a setting.

Adaptive beta is automatic. Each choice step recomputes the current conditioned standard deviation and uses `1 / current standard deviation`.

Score-guided backtracking is controlled by `HC backtrack tries`, which defaults to `0`. On SAT-based reduction tabs, `0` means one greedy SAT witness branch with no saved alternatives; raising the value queues next-best witness branches. `HC tour search` can either stop when the first Hamiltonian witness is accepted or keep searching all allowed tries and list distinct witnesses it finds. Matrix, points, and manual weighted tabs keep using the all-tries best-tour behavior. The visible solver tuning is the HC solve node limit, `HC backtrack tries`, `HC repair passes`, and `HC tour search`.

Candidate edges are normalized with the state function omega. For each valid edge, the app uses the count term `N(e) = 2^(CE - 1) * (n - 1 - VCE + CE)!`, computes `L(e) = ln(N(e)) - beta * mean + 0.5 * beta^2 * variance`, shifts by `M = max L`, then uses `P(e) = exp(L(e) - M) / omega` with `omega = sum exp(L(f) - M)`.

Before scoring, the HC solver runs the original degree-2 forced-edge precheck: if a vertex has exactly two listed HC edges, both are forced into the tour before the scoring loop continues. The stronger dynamic pruning experiment was removed because it was slower and rejected useful branches on the reduction tabs.

`HC repair passes` defaults to `0`. When raised for raw HC/TSP-style tours, it runs local repair after the math-selected tour. SAT-based reduction tabs do not need repair to complete unrelated HC edges after their original decision witnesses are committed.

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

On the 3-SAT tab and the tabs that pass through generated 3-SAT, the browser now scores SAT witness choices first. For `V` checked Boolean decision variables, that means `2V` logical witness choices. Each choice is represented by a paired HC diagonal decision; either valid diagonal commits the same VC consequence, then the gadget propagation forces the paired chain. After the relevant original decision variables are committed, the tab checks the inferred original witness instead of spending time scoring unrelated HC completion edges. Set Cover and X3C check selected set variables, Graph Coloring checks vertex-color choices, Sudoku checks placement choices, and Packing checks candidate placement choices.

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

## Sudoku tool

The Sudoku tab is visual. Choose the square box size, then build the grid:

```text
box size = 3
grid size = 9 x 9
```

Other supported visual sizes:

```text
2 x 2 boxes -> 4 x 4 Sudoku
3 x 3 boxes -> 9 x 9 Sudoku
4 x 4 boxes -> 16 x 16 Sudoku
5 x 5 boxes -> 25 x 25 Sudoku
```

The app uses numeric values. For 16x16, users type `10` through `16` directly. For 25x25, users type `10` through `25` directly.

The app uses the exact placement model:

```text
one variable = row r, column c, digit d
each cell has exactly one digit
each row has each digit once
each column has each digit once
each box has each digit once
Sudoku -> exact cover style 3-SAT -> Vertex Cover clause triangles -> direct Hamiltonian Cycle
```

For 4x4, 9x9, and 16x16, the exact reduction size is posted, and the degree-2 forced-edge precheck is posted when the HC graph is small enough to materialize. For 25x25, the app counts the exact 3-SAT and estimated Vertex-Cover-to-HC size without materializing every clause and edge, because the full graph is too large for browser memory. Sudoku only displays a filled visual witness after the HC solver returns YES for a materialized reduced graph.

## 3D Packing tool

The 3D packing tab asks for truck length, width, height, max weight, max packing options sent to HC, rotation settings, and box rows with:

```text
name length width height weight quantity stackable fragile max_top_weight
```

Example values already load in the form:

```text
Truck: 20 x 8 x 8, max weight 4000
A: 5 x 4 x 3, weight 120, quantity 4, stackable
B: 4 x 3 x 2, weight 70, quantity 8, stackable
C: 3 x 2 x 2, weight 40, quantity 10, fragile
```

The app first builds a practical extreme-point packing and draws it in the canvas. Then it creates a low-node candidate-placement decision model:

```text
one variable = one box at one generated position and orientation
one box chooses one candidate
overlapping candidates cannot both be chosen
candidate-placement 3-SAT -> Vertex Cover clause triangles -> direct Hamiltonian Cycle
```

The Hamiltonian-cycle side uses the same classic 3-SAT-to-Vertex-Cover bridge and degree-2 forced-edge precheck as the other SAT-based NP-complete tools. Raise max packing options sent to HC when you want broader HC search space; lower it when you want fewer nodes and faster runs.
