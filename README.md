# NP-douce 1.2

**NP-douce** is an experimental research application for exploring combinatorial optimization problems using ideas from statistical mechanics, exact combinatorial counting, and constrained solution-sp[...]

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

## Theory overview

For a complete weighted graph

```math
G = (V, E)
```

with `n = |V|` vertices, NP-douce studies the ensemble of Hamiltonian cycles. The number of distinct undirected Hamiltonian cycles is:

```math
\Omega_0 = \frac{(n - 1)!}{2}
```

Rather than enumerating every tour, the app computes aggregate properties of the Hamiltonian solution space:

- number of Hamiltonian states
- exact average tour weight
- variance and standard deviation of tour weights
- statistics conditioned on selected edges
- approximate partition functions
- candidate-edge importance scores
- iterative construction of a Hamiltonian tour or reduced-problem witness

Through polynomial-time reductions, the same Hamiltonian-cycle framework is used for 3-SAT, Vertex Cover, Clique, Independent Set, Set Cover, X3C, and Graph Coloring. The app should still be treat[...]

## Statistical-mechanical model

Each Hamiltonian cycle `τ` is treated as a microstate with energy equal to its tour weight:

```math
H(\tau) = \sum_{e \in \tau} w_e
```

The partition function is:

```math
Z(\beta) = \sum_{\tau \in \mathcal{H}} e^{-\beta H(\tau)}
```

Here `β` is the inverse-temperature parameter and `ℋ` is the set of Hamiltonian cycles. At `β = 0`, all Hamiltonian cycles have equal statistical weight:

```math
Z(0) = \Omega_0 = \frac{(n - 1)!}{2}
```

## Exact mean tour weight

Every edge in the complete graph `K_n` occurs in exactly `(n - 2)!` Hamiltonian cycles. If

```math
W = \sum_{e \in E} w_e
```

then the exact mean weight of all Hamiltonian cycles is:

```math
\mu = \frac{2W}{n - 1}
```

This can be computed directly from the graph without enumerating Hamiltonian tours.

## Tour-weight variance

The tour energy can be written using edge-indicator variables:

```math
H(\tau) = \sum_{e \in E} w_e X_e(\tau)
```

where `X_e(τ) = 1` when edge `e` is in the tour and `0` otherwise.

The tour-weight variance is:

```math
\sigma^2 = \langle H^2 \rangle - \mu^2
```

The implementation evaluates the second moment using combinatorial classes of edge pairs instead of summing over every Hamiltonian cycle.

Define three graph-wide sums:

```math
S_2 = \sum_{e \in E} w_e^2
```

```math
A = \sum w_e w_f
```

where the sum for `A` is over pairs of distinct edges that share a vertex.

```math
D = \sum w_e w_f
```

where the sum for `D` is over pairs of distinct edges that do not share a vertex.

Here:

- `S_2` is the sum of squared edge weights.
- `A` is the sum of products for edge pairs that share a vertex.
- `D` is the sum of products for edge pairs that are vertex-disjoint.

The probabilities come from Hamiltonian-cycle counting in `K_n`:

```math
P(e \in \tau) = \frac{2}{n - 1}
```

```math
P(e,f \in \tau \mid e \cap f \neq \varnothing) = \frac{2}{(n - 1)(n - 2)}
```

```math
P(e,f \in \tau \mid e \cap f = \varnothing) = \frac{4}{(n - 1)(n - 2)}
```

Since

```math
H(\tau)^2
=
\left(\sum_{e \in E} w_e X_e(\tau)\right)^2
```

```math
=
\sum_{e \in E} w_e^2 X_e(\tau)
+
2\sum_{e<f} w_e w_f X_e(\tau)X_f(\tau)
```

the exact second moment is:

```math
\langle H^2 \rangle =
\frac{2}{n - 1}S_2
+ \frac{4}{(n - 1)(n - 2)}A
+ \frac{8}{(n - 1)(n - 2)}D
```

Equivalently, the code writes the pair part as:

```math
\langle H^2 \rangle =
\frac{2}{n - 1}S_2
+ \frac{4}{(n - 1)(n - 2)}(A + 2D)
```

Finally:

```math
\sigma^2 =
\frac{2}{n - 1}S_2
+ \frac{4}{(n - 1)(n - 2)}(A + 2D)
- \mu^2
```

This is why the app can calculate the variance without enumerating the `(n-1)!/2` Hamiltonian cycles. It only needs to scan edges and classify edge pairs by whether they touch or are disjoint.

During tour construction the variance is recalculated after some edges have already been committed. The same principle is used, but the remaining graph is no longer a clean unconstrained `K_n` en[...]

- **free-free**: both endpoints are unused.
- **active-free**: one endpoint is an open chain endpoint and the other is unused.
- **active-active**: both endpoints are open chain endpoints from different chains.

Let `F_C` be the fixed weight of the committed edges, `u` be the number of vertices already used by committed edges, and `c` be the current number of open chains. The remaining factorial term is:

```math
r = n - 1 + c - u
```

The conditioned mean has the form:

```math
\mu_C =
F_C
+ \frac{1}{2r}S_{AA}
+ \frac{1}{r}S_{AF}
+ \frac{2}{r}S_{FF}
```

where `S_AA`, `S_AF`, and `S_FF` are the sums of remaining edge weights in the active-active, active-free, and free-free classes.

The conditioned variance uses the same idea as the unconstrained formula:

```math
\sigma_C^2 = \langle (H - F_C)^2 \rangle_C - (\mu_C - F_C)^2
```

The app computes `⟨(H - F_C)²⟩_C` by bucketed edge-pair products: active-active pairs, active-free touching pairs, active-free disjoint pairs, free-free touching pairs, and free-free disjoin[...]

## Partition-function approximation

Expanding the logarithm of the partition function around `β = 0` gives the cumulant expansion:

```math
\ln Z(\beta) = \ln \Omega - \beta\kappa_1 + \frac{\beta^2}{2}\kappa_2 - \cdots
```

Using `κ_1 = μ` and `κ_2 = σ²`, NP-douce uses the second-order approximation:

```math
\ln Z(\beta) \approx \ln \Omega - \beta\mu + \frac{\beta^2\sigma^2}{2}
```

This gives a compact statistical description of a very large Hamiltonian solution space.

## Constrained Hamiltonian ensembles

NP-douce also calculates statistics after some edges have already been chosen. Let `C` be the set of edges forced into the tour. The constrained ensemble is:

```math
\mathcal{H}_C = \{\tau \in \mathcal{H} : C \subseteq \tau\}
```

For compatible configurations, the constrained state count is:

```math
\Omega_C = 2^{|C| - 1}(n - 1 + |C| - |V_C|)!
```

where `|C|` is the number of selected edges and `|V_C|` is the number of vertices touched by those edges.

The constrained statistical model is:

```math
\ln Z_C(\beta) \approx \ln \Omega_C - \beta\mu_C + \frac{\beta^2\sigma_C^2}{2}
```

## Edge importance

For a candidate edge `e`, NP-douce compares the constrained ensemble where the edge is chosen with the constrained ensemble where the edge is forbidden.

```math
I_t(e)
=
\ln Z(CE_t \cup \{e\})
-
\ln Z(CE_t \cup \{\bar e\})
```

Here `CE_t` is the committed-edge set at step `t`, and `ē` denotes that edge `e` is forbidden.

Using the second-order approximation:

```math
I_t(e)
\approx
\ln
\frac{\Omega(CE_t \cup \{e\})}
{\Omega(CE_t \cup \{\bar e\})}
-
\beta \Delta \mu_e
+
\frac{\beta^2}{2}\Delta \sigma_e^2
```

The point is not just to prefer a small edge weight. The score asks how choosing that edge changes the statistical structure of the remaining Hamiltonian solution space.

## Tour and witness construction

Starting from no committed edges, the app evaluates admissible candidate edges and selects:

```math
e_t^* = \arg\max_{e \in A_t} I_t(e)
```

Then it updates the committed-edge set:

```math
CE_{t+1} = CE_t \cup \{e_t^*\}
```

The admissible set is restricted so Hamiltonian feasibility is preserved, including degree constraints and prevention of premature subtours.

For reduction tabs, the displayed answer is inferred back into the original problem. For example, a Hamiltonian witness produced by a Clique reduction is translated back into a clique such as `{1[...]

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

Large Hamiltonian graphs can still be expensive because the original theory includes nested pair/edge calculations. Matrix, points, manual, and pair inputs do not have a fixed app maximum; their [...]

Reduction tabs now use this strict flow for their displayed answer:

```text
original problem → reduction → HC graph → NP-douce HC solver → inferred original answer
```

When the HC solver returns YES, reduction tabs print concrete original-problem witnesses, such as SAT assignments, vertex covers, cliques, independent sets, selected sets, or colorings. The displ[...]

The raw Hamiltonian Pairs tab keeps scoring restricted to real `-1` HC edges. Before scoring, it applies only necessary HC facts: every vertex must have at least two usable HC edges, the usable g[...]

The TSP Points tab keeps the same score-guided method, then applies the Euclidean no-crossing fact to remove crossing edges from a completed points tour. Matrix and manual TSP inputs are not give[...]

If the reduced HC graph is above the app's `HC solve node limit`, the tab reports `NOT COMPUTED` instead of using a separate direct solver. Raise the limit when you want to force a larger reduced[...]

Reduction tabs run the HC solver over the full set of real allowed HC edges from the start. They still skip zero-weight non-edges, because those cannot contribute to the target `-n` Hamiltonian t[...]

Before a generated 3-SAT formula is sent to Vertex Cover, reduction tabs run exact unit-clause simplification. A clause like `[-3, -3, -3]` is treated as the unit clause `~x3`, so `x3=false` is f[...]

The HC solver now uses the importance score automatically:

```math
I_t(e)
=
\ln Z(CE_t \cup \{e\})
-
\ln Z(CE_t \cup \{\bar e\})
```

The older omega-only score is no longer exposed as a setting.

Adaptive beta is automatic. Each choice step recomputes the current conditioned standard deviation and uses:

```math
\beta = \frac{1}{\sigma_C}
```

Score-guided backtracking is controlled by `HC backtrack tries`, which defaults to `0`. On SAT-based reduction tabs, `0` means one greedy SAT witness branch with no saved alternatives; raising th[...]

Candidate edges are normalized with the state function `ω`. For each valid edge, the app uses the count term:

```math
N(e) = 2^{CE - 1}(n - 1 - VCE + CE)!
```

Then it computes:

```math
L(e) = \ln N(e) - \beta\mu_e + \frac{1}{2}\beta^2\sigma_e^2
```

After shifting by `M = max_f L(f)`, the probability-style normalization is:

```math
P(e) = \frac{e^{L(e)-M}}{\omega},
\qquad
\omega = \sum_f e^{L(f)-M}
```

Before scoring, the raw HC solver runs necessary graph checks and the original degree-2 forced-edge precheck: if a vertex has exactly two listed HC edges, both are forced into the tour before the[...]

`TSP repair passes` appears only inside the matrix, points, and manual TSP tabs. It defaults to `0`. When raised, it runs local repair only after weighted TSP tours are built. Reduction tabs and [...]

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
3-SAT → Vertex Cover clause triangles → direct Vertex Cover HC gadget
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

The app uses the direct classic Vertex Cover to Hamiltonian Cycle construction. Each original graph edge becomes a 12-node gadget with endpoint rows and crosses `u1-v3`, `v1-u3`, `u6-v4`, and `u4[...]

Incident rows for the same original vertex are linked as `u6 → next u1`, so the degree-2 precheck collapses most of each gadget before the remaining selector and cross edges are scored by the H[...]

On the 3-SAT tab and the tabs that pass through generated 3-SAT, the browser now scores SAT witness choices first. For `V` checked Boolean decision variables, that means `2V` logical witness choi[...]

The direct Vertex Cover tab now uses the same witness-choice pattern. For `n` original vertices, it scores `2n` logical choices: `cover(v)` and `not cover(v)`. Clique and Independent Set inherit [...]

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
Clique(G, k) → Vertex Cover(complement(G), vertices - k) → direct 12-node-gadget Hamiltonian Cycle
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
Independent Set(G, k) → Vertex Cover(G, vertices - k) → direct 12-node-gadget Hamiltonian Cycle
```

Example:

```text
5 3
1 2
2 3
3 4
4 5
```

This example has an independent set `{1, 3, 5}`. Because this route goes directly to Vertex Cover on the same graph, it avoids an extra complement graph step before the Hamiltonian-cycle calculat[...]

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
Set Cover → 3-SAT coverage clauses plus at-most-k → Vertex Cover clause triangles → direct Hamiltonian Cycle
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
X3C → 3-SAT exactly-once coverage clauses → Vertex Cover clause triangles → direct Hamiltonian Cycle
```

Example:

```text
6 4
1 2 3
4 5 6
1 4 5
2 3 6
```

This example has an exact cover `{S1, S2}`. The 3-SAT encoding uses one Boolean variable per 3-set, one at-least-one coverage clause for each universe element, and pairwise not-both clauses for e[...]

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
Graph Coloring → 3-SAT color clauses → Vertex Cover clause triangles → direct Hamiltonian Cycle
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

That second graph is `K4`: it is not 3-colorable, but it is 4-colorable. The 3-SAT encoding uses `colors * vertices` base variables, one at-least-one-color clause per vertex, pairwise not-both co[...]

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

The project is intended to support experimentation, verification, benchmarking, and visualization of the mathematical framework. Results from the software should be independently verified when us[...]

## Goals

The project explores whether useful global information about difficult combinatorial solution spaces can be obtained from exact combinatorial statistics.

In particular, NP-douce investigates the relationship:

```math
\text{Combinatorics} \longleftrightarrow \text{Statistical Mechanics} \longleftrightarrow \text{Optimization}
```

The central quantities are:

```math
\boxed{\Omega,\quad \mu,\quad \sigma^2,\quad \ln Z,\quad I(e)}
```

Together they provide a statistical representation of the Hamiltonian solution space and a mechanism for comparing candidate optimization decisions across NP-complete problem classes.

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

This repository contains experimental research software. The implementation and numerical experiments are intended for research and educational purposes. Computational demonstrations should not b[...]
