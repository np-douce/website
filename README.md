# NP-douce

Open `index.html` in a browser to run the app.

The app is static: it uses only local HTML, CSS, and JavaScript. No server is required for desktop use.

## Included tools

- 3-SAT polynomial Hamiltonian-cycle reduction
- Vertex Cover to 3-SAT to compressed Hamiltonian-cycle reduction
- Clique to Vertex Cover complement to 3-SAT to compressed Hamiltonian-cycle reduction
- Independent Set to Vertex Cover to 3-SAT to compressed Hamiltonian-cycle reduction
- Set Cover to 3-SAT to compressed Hamiltonian-cycle reduction
- X3C to 3-SAT to compressed Hamiltonian-cycle reduction
- Graph Coloring to 3-SAT to compressed Hamiltonian-cycle reduction
- Visual Sudoku to exact-cover 3-SAT to compressed Hamiltonian-cycle reduction
- 3D truck/container packing with a compact candidate-placement HC reduction
- Hamiltonian pairs input
- Matrix input
- Euclidean points input
- Manual upper-triangle edge input

## Math note

The Hamiltonian/TSP theory calculations are ported from the C++ formulas using JavaScript `Number`, which is IEEE-754 double precision like C++ `double`.

Large Hamiltonian graphs can still be expensive because the original theory includes nested pair/edge calculations. Matrix, points, manual, and pair inputs do not have a fixed app maximum; their practical size depends on the input and the device running the browser.

Reduction tabs now use this strict flow for their displayed answer:

```text
original problem -> reduction -> compressed HC graph -> NP-douce HC solver -> inferred original answer
```

If the compressed HC graph is above the app's `HC solve node limit`, the tab reports `NOT COMPUTED` instead of using a separate direct solver. Raise the limit when you want to force a larger reduced HC instance through the solver, but large values can run very slowly.

Compressed reductions now run the HC solver over the full set of real allowed HC edges from the start. They still skip zero-weight non-edges, because those cannot contribute to the target `-n` Hamiltonian tour.

`HC beta multiplier` controls the beta temperature used by the reduction solver. The app computes its suggested beta from the graph variance, then multiplies it by this value, so `0.25` means one-quarter of the suggested beta.

`adaptive beta` changes beta during the HC solve. When it is on, each choice step recomputes the current conditioned standard deviation and uses `beta multiplier / current standard deviation`.

`HC backtrack tries` lets the HC solver revisit close decisions. The score formula ranks every valid edge, the greedy edge is tried first, and alternate branches are kept when their score is close to the best edge. Higher values can improve accuracy but may run much slower.

Candidate edges are normalized with the state function omega. For each valid edge, the app uses the count term `N(e) = 2^(CE - 1) * (n - 1 - VCE + CE)!`, computes `L(e) = ln(N(e)) - beta * mean + 0.5 * beta^2 * variance`, shifts by `M = max L`, then uses `P(e) = exp(L(e) - M) / omega` with `omega = sum exp(L(f) - M)`.

`HC repair passes` runs local repair after the math-selected tour. The repair keeps the original HC math as the first pass, fills unfinished reduction tours with neutral zero placeholders, then accepts only 2-opt or targeted 3-opt swaps that lower the final tour cost toward the Hamiltonian target.

## 3-SAT input format

The first line is:

```text
variables clauses optional_padding_directed_nodes
```

Each following line is one clause with three integer literals:

```text
1 -2 3
```

This means:

```text
(x1 OR ~x2 OR x3)
```

Node count for the polynomial reduction:

```text
undirected nodes = 3 * (variables * (clauses + 1) + clauses + 2 + padding)
```

## Vertex Cover input format

The first line is:

```text
vertices k optional_padding_directed_nodes
```

Each following line is one undirected edge:

```text
1 2
2 3
```

The app reduces the instance to 3-SAT, builds the compressed Hamiltonian-cycle graph, runs the NP-douce HC solver when under the node limit, and infers whether a vertex cover of size at most `k` exists from the HC result.

The at-most-`k` part uses a sequential counter encoding, so it grows closer to `O(vertices * k)` instead of enumerating every `k + 1` subset.

## Clique input format

The first line is:

```text
vertices k optional_padding_directed_nodes
```

Each following line is one undirected edge:

```text
1 2
1 3
2 3
```

This asks whether the graph has a clique of size at least `k`. The app uses the standard practical reduction:

```text
Clique(G, k) -> Vertex Cover(complement(G), vertices - k) -> 3-SAT -> compressed Hamiltonian Cycle
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

This example has a clique `{1, 2, 3}`. The Hamiltonian-cycle side still uses the compressed reduction and degree-2 forced-edge precheck.

## Independent Set input format

The first line is:

```text
vertices k optional_padding_directed_nodes
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
Independent Set(G, k) -> Vertex Cover(G, vertices - k) -> 3-SAT -> compressed Hamiltonian Cycle
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
universe_size set_count k optional_padding_directed_nodes
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
Set Cover -> 3-SAT coverage clauses plus at-most-k -> compressed Hamiltonian Cycle
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
universe_size set_count optional_padding_directed_nodes
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
X3C -> 3-SAT exactly-once coverage clauses -> compressed Hamiltonian Cycle
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
vertices edges colors optional_padding_directed_nodes
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
Graph Coloring -> 3-SAT color clauses -> compressed Hamiltonian Cycle
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
Sudoku -> exact cover style 3-SAT -> compressed Hamiltonian Cycle
```

For 4x4, 9x9, and 16x16, the exact reduction size and degree-2 forced-edge precheck are posted. For 25x25, the app counts the exact 3-SAT and compressed-HC size without materializing every clause and edge, because the full graph is too large for browser memory. Sudoku only displays a filled visual witness after the HC solver returns YES for a materialized reduced graph.

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
candidate-placement 3-SAT -> compressed Hamiltonian Cycle
```

The Hamiltonian-cycle side uses the same compressed reduction and degree-2 forced-edge precheck as the other NP-complete tools. Raise max packing options sent to HC when you want broader HC search space; lower it when you want fewer nodes and faster runs.
