# NP-Soft

**NP-Soft** is an experimental research application for exploring combinatorial optimization problems using ideas from **statistical mechanics, exact combinatorial counting, and constrained solution spaces**.

The application is designed to study problems such as the **Traveling Salesman Problem (TSP)** and related Hamiltonian-cycle problems by analyzing the statistical properties of large sets of candidate solutions rather than enumerating every possible solution individually.

## Live Demo

A browser-based version of the application can be hosted with GitHub Pages.

**Live App:**
`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

Replace the link above with the actual GitHub Pages address for this repository.

---

## Overview

For a complete weighted graph

[
G=(V,E),
]

with (n=|V|) vertices, NP-Soft considers the complete ensemble of Hamiltonian cycles.

The number of distinct undirected Hamiltonian cycles is

[
\Omega_0=\frac{(n-1)!}{2}.
]

Rather than generating all of these tours explicitly, the program computes aggregate properties of the Hamiltonian solution space.

These include:

* number of Hamiltonian states,
* exact average tour weight,
* variance and standard deviation of tour weights,
* statistics conditioned on selected edges,
* approximate partition functions,
* candidate-edge importance scores,
* iterative construction of a Hamiltonian tour.

---

# Statistical-Mechanical Model

Each Hamiltonian cycle (\tau) is treated as a microstate with energy equal to its tour weight,

[
H(\tau)=\sum_{e\in\tau}w_e.
]

The associated partition function is

[
Z(\beta)
========

\sum_{\tau\in\mathcal H}
 e^{-\beta H(\tau)},
]

where (\beta) is an inverse-temperature parameter and (\mathcal H) is the set of Hamiltonian cycles.

At

[
\beta=0,
]

all Hamiltonian cycles have equal statistical weight, giving

[
Z(0)=\Omega_0
=============

\frac{(n-1)!}{2}.
]

---

# Exact Mean Tour Weight

Every edge in the complete graph (K_n) occurs in exactly

[
(n-2)!
]

Hamiltonian cycles.

If

[
W=\sum_{e\in E}w_e,
]

then the exact mean weight of all Hamiltonian cycles is

[
\boxed{
\mu
===

\frac{2}{n-1}
\sum_{e\in E}w_e
}
]

or equivalently,

[
\boxed{
H_{\mathrm{avg}}
================

\frac{2W}{n-1}.
}
]

This quantity can be computed directly from the graph without enumerating all Hamiltonian tours.

---

# Tour-Weight Variance

The tour energy can be written using edge-indicator variables,

[
H(\tau)
=======

\sum_{e\in E}
w_eX_e(\tau),
]

where

[
X_e(\tau)=
\begin{cases}
1, & e\in\tau,\\
0, & e\notin\tau.
\end{cases}
]

The variance of the Hamiltonian tour-weight distribution is

[
\boxed{
\sigma^2
========

## \left\langle H^2\right\rangle

\mu^2.
}
]

The standard deviation is

[
\boxed{
\sigma
======

\sqrt{
\left\langle H^2\right\rangle-\mu^2
}.
}
]

The implementation evaluates the second moment using combinatorial classes of edge pairs rather than explicitly summing over every Hamiltonian cycle.

---

# Partition-Function Approximation

Expanding the logarithm of the partition function around (\beta=0) gives the cumulant expansion

[
\ln Z(\beta)
============

\ln\Omega
-\beta\kappa_1
+\frac{\beta^2}{2!}\kappa_2
-\frac{\beta^3}{3!}\kappa_3
+\cdots.
]

Using

[
\kappa_1=\mu
]

and

[
\kappa_2=\sigma^2,
]

NP-Soft uses the second-order approximation

[
\boxed{
\ln Z(\beta)
\approx
\ln\Omega
---------

\beta\mu
+
\frac{\beta^2\sigma^2}{2}.
}
]

This provides a compact statistical description of an otherwise extremely large Hamiltonian solution space.

---

# Constrained Hamiltonian Ensembles

NP-Soft can also calculate statistics after certain edges have already been chosen.

Let

[
C={e_1,e_2,\ldots,e_k}
]

be the current set of constrained edges.

The corresponding Hamiltonian ensemble is

[
\mathcal H_C
============

{\tau\in\mathcal H:
C\subseteq\tau
}.
]

For compatible chosen-edge configurations, the state count used by the program is

[
\boxed{
\Omega_C
========

2^{|C|-1}
\left(
 n-1+|C|-|V_C|
\right)!
}
]

where:

* (|C|) is the number of selected edges,
* (|V_C|) is the number of vertices touched by those edges.

The constrained statistical model then becomes

[
\boxed{
\ln Z_C(\beta)
\approx
\ln\Omega_C
-----------

\beta\mu_C
+\n\frac{\beta^2\sigma_C^2}{2}.
}
]

---

# Edge Importance

For a candidate edge (e), NP-Soft compares two possible future solution spaces:

1. tours where the edge is selected,
2. tours where the edge is forbidden.

The edge-importance score is

[
\boxed{
I(e)
====

## \ln Z_{C+e}

\ln Z_{C-e}.
}
]

Using the second-order approximation,

[
I(e)
\approx
\ln\left(
\frac{\Omega_{C+e}}
{\Omega_{C-e}}
\right)
-------

\beta\Delta\mu_e
+
\frac{\beta^2}{2}
\Delta\sigma_e^2.
]

Here,

[
\Delta\mu_e
===========

\mu_{C+e}-\mu_{C-e},
]

and

[
\Delta\sigma_e^2
================

\sigma_{C+e}^2-\sigma_{C-e}^2.
]

The program can therefore evaluate candidate edges based not only on their individual weights, but also on how each decision changes the statistical properties of the remaining Hamiltonian solution space.

---

# Tour Construction

Starting from

[
C_0=\varnothing,
]

the program evaluates admissible candidate edges and selects

[
e_t^\ast
========

\operatorname*{arg,max}_{e}
I_t(e).
]

The chosen-edge set is then updated:

[
C_{t+1}
=======

C_t\cup{e_t^\ast}.
]

This procedure is repeated while maintaining Hamiltonian feasibility constraints, including vertex degree restrictions and prevention of premature subtours.

The process continues until the selected edges form a complete Hamiltonian cycle.

---

# Conceptual Flow

The overall framework can be summarized as

```text
Weighted Graph
      |
      v
Exact Combinatorial Counting
      |
      v
State Count, Mean, Variance
      |
      v
Approximate ln Z
      |
      v
Candidate Edge Importance
      |
      v
Iterative Edge Selection
      |
      v
Hamiltonian Tour
```

---

# Application

The browser application provides an interactive implementation of the framework.

Depending on the current version, the interface may allow users to:

* enter or load a graph,
* provide coordinates or edge weights,
* calculate Hamiltonian ensemble statistics,
* inspect average tour weights,
* inspect standard deviations,
* calculate candidate-edge scores,
* observe the sequence of selected edges,
* generate a final Hamiltonian tour,
* experiment with different values of (\beta).

---

# Research Status

NP-Soft should be considered an **experimental research prototype and reference implementation**.

The application is intended to support experimentation, verification, benchmarking, and visualization of the mathematical framework.

Results obtained from the software should be independently verified when used for formal mathematical or complexity-theoretic claims.

---

# Repository Structure

A typical repository layout is

```text
NP-Soft/
│
├── index.html
├── app.js
├── styles.css
├── manifest.json
├── sw.js
│
├── src/
│   └── algorithm source files
│
├── examples/
│   └── sample graph instances
│
├── results/
│   └── example outputs
│
└── README.md
```

The exact structure may vary as the project develops.

---

# Running the Browser Version

The web version can be opened through GitHub Pages.

If GitHub Pages is enabled for this repository, the application will normally be available at

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

For local testing, the files may also be served using a local HTTP server.

Because the application uses browser technologies such as JavaScript, caching, and potentially service workers, behavior may differ slightly between a local environment and GitHub Pages.

---

# Offline Support

The browser version may use a service worker to cache application resources.

Once the required files have been cached, supported browsers may allow portions of the application to continue functioning without an active internet connection.

Files commonly involved include

```text
manifest.json
sw.js
index.html
app.js
styles.css
```

---

# Example Mathematical Output

For a graph with (n) vertices, the application may report quantities such as

```text
Number of vertices: n

Average tour weight:
μ = ...

Variance:
σ² = ...

Standard deviation:
σ = ...

Inverse temperature:
β = ...

Candidate edge:
(i,j)

Importance:
I(i,j) = ...
```

The exact output depends on the selected problem and implementation.

---

# Goals

The project is intended to explore whether useful global information about difficult combinatorial solution spaces can be obtained from exact combinatorial statistics.

In particular, NP-Soft investigates the relationship

[
\text{Combinatorics}
\quad\longleftrightarrow\quad
\text{Statistical Mechanics}
\quad\longleftrightarrow\quad
\text{Optimization}.
]

The central quantities are

[
\boxed{
\Omega,\qquad
\mu,\qquad
\sigma^2,\qquad
\ln Z,\qquad
I(e).
}
]

Together they provide a statistical representation of the Hamiltonian solution space and a mechanism for comparing candidate optimization decisions.

---

# Citation

If you use this project in academic work, please cite the associated paper or repository.

A formal citation can be added here once the final publication information is available.

```bibtex
@software{npsoft,
  author = {Michel Seraphin},
  title  = {NP-Soft},
  year   = {2026},
  note   = {Experimental research software for combinatorial optimization}
}
```

---

# Author

**Michel Seraphin**

Independent research in combinatorial optimization, Hamiltonian problems, and statistical-mechanical methods for discrete systems.

---

# Disclaimer

This repository contains experimental research software.

The implementation and numerical experiments are intended for research and educational purposes. Computational demonstrations should not be interpreted by themselves as formal proofs of complexity-theoretic results.
