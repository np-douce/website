"use strict";

const output = document.getElementById("output");

function write(text) {
  output.textContent = text;
}

function append(lines, text = "") {
  if (!lines) return;
  lines.push(text);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 1e-4)) {
    return value.toExponential(6);
  }
  return Number(value.toPrecision(10)).toString();
}

function lnGamma(z) {
  const coeff = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < coeff.length; i++) {
    x += coeff[i] / (z + i + 1);
  }
  const t = z + coeff.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function makeMatrix(n, fill = 0) {
  return Array.from({ length: n + 1 }, () => Array(n + 1).fill(fill));
}

function buildSquaredEdgeMatrix(edge, n) {
  const edgeSquared = makeMatrix(n);
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      edgeSquared[i][j] = edge[i][j] * edge[i][j];
    }
  }
  return edgeSquared;
}

function buildNonzeroEdgeList(edge, n) {
  const edgeList = [];
  for (let i = 1; i < n; i++) {
    for (let j = i + 1; j <= n; j++) {
      const weight = edge[i][j];
      if (weight === 0) continue;
      edgeList.push({
        from: i,
        to: j,
        weight,
        weightSquared: weight * weight,
        key: edgeKey(i, j)
      });
    }
  }
  return attachEdgeListAdjacency(edgeList, n);
}

function attachEdgeListAdjacency(edgeList, n) {
  if (edgeList.adjacencyByVertex) return edgeList;
  const adjacencyByVertex = Array.from({ length: n + 1 }, () => []);
  for (const item of edgeList) {
    adjacencyByVertex[item.from].push({ to: item.to, weight: item.weight });
    adjacencyByVertex[item.to].push({ to: item.from, weight: item.weight });
  }
  Object.defineProperty(edgeList, "adjacencyByVertex", {
    value: adjacencyByVertex,
    enumerable: false,
    configurable: true
  });
  return edgeList;
}

function hamiltonianNecessaryGraphCheck(edge, n) {
  if (n < 3) return { ok: true, reason: "" };
  const adjacency = Array.from({ length: n + 1 }, () => []);
  for (let i = 1; i < n; i++) {
    for (let j = i + 1; j <= n; j++) {
      if (edge[i][j] === 0) continue;
      adjacency[i].push(j);
      adjacency[j].push(i);
    }
  }

  for (let vertex = 1; vertex <= n; vertex++) {
    if (adjacency[vertex].length < 2) {
      return { ok: false, reason: `vertex ${vertex} has only ${adjacency[vertex].length} usable HC edges` };
    }
  }

  const seen = Array(n + 1).fill(false);
  const stack = [1];
  seen[1] = true;
  while (stack.length > 0) {
    const vertex = stack.pop();
    for (const neighbor of adjacency[vertex]) {
      if (seen[neighbor]) continue;
      seen[neighbor] = true;
      stack.push(neighbor);
    }
  }
  for (let vertex = 1; vertex <= n; vertex++) {
    if (!seen[vertex]) return { ok: false, reason: `the usable HC graph is disconnected at vertex ${vertex}` };
  }

  const discovery = Array(n + 1).fill(0);
  const low = Array(n + 1).fill(0);
  let time = 0;
  let bridge = null;
  let articulation = 0;

  const dfs = (vertex, parent) => {
    discovery[vertex] = low[vertex] = ++time;
    let childCount = 0;
    for (const neighbor of adjacency[vertex]) {
      if (neighbor === parent) continue;
      if (!discovery[neighbor]) {
        childCount += 1;
        dfs(neighbor, vertex);
        low[vertex] = Math.min(low[vertex], low[neighbor]);
        if (!bridge && low[neighbor] > discovery[vertex]) {
          bridge = [vertex, neighbor];
        }
        if (!articulation &&
            ((parent === 0 && childCount > 1) || (parent !== 0 && low[neighbor] >= discovery[vertex]))) {
          articulation = vertex;
        }
      } else {
        low[vertex] = Math.min(low[vertex], discovery[neighbor]);
      }
    }
  };

  dfs(1, 0);
  if (bridge) return { ok: false, reason: `usable HC edge ${bridge[0]}-${bridge[1]} is a bridge` };
  if (articulation) return { ok: false, reason: `vertex ${articulation} is an articulation point in the usable HC graph` };
  return { ok: true, reason: "" };
}

function numericEdgeKey(from, to, stride) {
  return from < to ? (from * stride) + to : (to * stride) + from;
}

function computeTheoryMoments(edge, edgeSquared, n) {
  const moments = {
    meanTourLength: 0,
    selfInteractionSum: 0,
    neighborInteractionSum: 0,
    disjointInteractionSum: 0,
    tourVariance: 0
  };
  const vertexCount = n;
  let edgeSum = 0;
  const incidentEdges = Array.from({ length: n + 1 }, () => []);
  for (let i = 1; i < n; i++) {
    for (let j = i + 1; j <= n; j++) {
      const weight = edge[i][j];
      edgeSum += weight;
      moments.selfInteractionSum += edgeSquared[i][j];
      if (weight === 0) continue;
      incidentEdges[i].push(weight);
      incidentEdges[j].push(weight);
    }
  }
  moments.meanTourLength = (2.0 / (vertexCount - 1.0)) * edgeSum;

  for (let i = 1; i <= n; i++) {
    for (let first = 0; first < incidentEdges[i].length; first++) {
      for (let second = first + 1; second < incidentEdges[i].length; second++) {
        moments.neighborInteractionSum += incidentEdges[i][first] * incidentEdges[i][second];
      }
    }
  }
  const allEdgePairProduct = ((edgeSum * edgeSum) - moments.selfInteractionSum) * 0.5;
  moments.disjointInteractionSum = allEdgePairProduct - moments.neighborInteractionSum;

  moments.tourVariance =
    ((2.0 / (vertexCount - 1.0)) * moments.selfInteractionSum) +
    ((4.0 / ((vertexCount - 1.0) * (vertexCount - 2.0))) *
      (moments.neighborInteractionSum + (2.0 * moments.disjointInteractionSum))) -
    (moments.meanTourLength * moments.meanTourLength);

  return moments;
}

function computeTheoryMomentsFromEdgeList(edgeList, n) {
  const moments = {
    meanTourLength: 0,
    selfInteractionSum: 0,
    neighborInteractionSum: 0,
    disjointInteractionSum: 0,
    tourVariance: 0
  };
  const vertexCount = n;
  let edgeSum = 0;
  const incidentEdges = Array.from({ length: n + 1 }, () => []);
  for (const item of edgeList) {
    const weight = item.weight;
    edgeSum += weight;
    moments.selfInteractionSum += item.weightSquared;
    if (weight === 0) continue;
    incidentEdges[item.from].push(weight);
    incidentEdges[item.to].push(weight);
  }
  moments.meanTourLength = (2.0 / (vertexCount - 1.0)) * edgeSum;

  for (let i = 1; i <= n; i++) {
    for (let first = 0; first < incidentEdges[i].length; first++) {
      for (let second = first + 1; second < incidentEdges[i].length; second++) {
        moments.neighborInteractionSum += incidentEdges[i][first] * incidentEdges[i][second];
      }
    }
  }
  const allEdgePairProduct = ((edgeSum * edgeSum) - moments.selfInteractionSum) * 0.5;
  moments.disjointInteractionSum = allEdgePairProduct - moments.neighborInteractionSum;

  moments.tourVariance =
    ((2.0 / (vertexCount - 1.0)) * moments.selfInteractionSum) +
    ((4.0 / ((vertexCount - 1.0) * (vertexCount - 2.0))) *
      (moments.neighborInteractionSum + (2.0 * moments.disjointInteractionSum))) -
    (moments.meanTourLength * moments.meanTourLength);

  return moments;
}

function pairProductFromSumAndSquares(sum, squareSum) {
  return ((sum * sum) - squareSum) * 0.5;
}

function collectAvailableVertices(endpointLink, n) {
  const values = [];
  for (let i = 1; i <= n; i++) if (endpointLink[i] !== -1) values.push(i);
  return values;
}

function accumulateRemainingEdgeBuckets(availableVertices, endpointLink, edge, edgeSquared, edgeList = null) {
  const buckets = {
    activeFreeSum: 0,
    activeActiveOpenSum: 0,
    freeFreeSum: 0,
    activeFreeSquareSum: 0,
    activeActiveOpenSquareSum: 0,
    freeFreeSquareSum: 0,
    activeActiveOpenPairSum: 0,
    activeFreeTouchingPairSum: 0,
    activeFreeDisjointPairSum: 0,
    freeFreeTouchingPairSum: 0,
    freeFreeDisjointPairSum: 0,
    mixedOpenTouchingPairSum: 0,
    mixedOpenFreePairSum: 0,
    activeFreeFreeTouchingPairSum: 0,
    activeFreeFreeDisjointPairSum: 0
  };

  if (edgeList) {
    for (const item of edgeList) {
      const y = item.from;
      const z = item.to;
      const yLink = endpointLink[y];
      const zLink = endpointLink[z];
      if (yLink === -1 || zLink === -1) continue;
      if ((yLink === 0 && zLink !== 0) || (yLink !== 0 && zLink === 0)) {
        buckets.activeFreeSum += item.weight;
        buckets.activeFreeSquareSum += item.weightSquared;
      }
      if (yLink !== 0 && zLink !== 0 && yLink !== z && zLink !== y) {
        buckets.activeActiveOpenSum += item.weight;
        buckets.activeActiveOpenSquareSum += item.weightSquared;
      }
      if (yLink === 0 && zLink === 0) {
        buckets.freeFreeSum += item.weight;
        buckets.freeFreeSquareSum += item.weightSquared;
      }
    }
    return buckets;
  }

  for (let a = 0; a < availableVertices.length; a++) {
    const y = availableVertices[a];
    for (let b = a + 1; b < availableVertices.length; b++) {
      const z = availableVertices[b];
      if ((endpointLink[y] === 0 && endpointLink[z] !== 0) ||
          (endpointLink[y] !== 0 && endpointLink[z] === 0)) {
        buckets.activeFreeSum += edge[y][z];
        buckets.activeFreeSquareSum += edgeSquared[y][z];
      }
      if (endpointLink[y] !== 0 && endpointLink[z] !== 0 &&
          endpointLink[y] !== z && endpointLink[z] !== y) {
        buckets.activeActiveOpenSum += edge[y][z];
        buckets.activeActiveOpenSquareSum += edgeSquared[y][z];
      }
      if (endpointLink[y] === 0 && endpointLink[z] === 0) {
        buckets.freeFreeSum += edge[y][z];
        buckets.freeFreeSquareSum += edgeSquared[y][z];
      }
    }
  }

  return buckets;
}

function accumulateVarianceBuckets(availableVertices, endpointLink, edge, buckets, edgeList = null) {
  const vertexCapacity = endpointLink.length;
  const activeFreeByActive = Array(vertexCapacity).fill(0);
  const activeFreeSquareByActive = Array(vertexCapacity).fill(0);
  const activeFreeByFree = Array(vertexCapacity).fill(0);
  const activeFreeSquareByFree = Array(vertexCapacity).fill(0);
  const freeFreeByFree = Array(vertexCapacity).fill(0);
  const freeFreeSquareByFree = Array(vertexCapacity).fill(0);
  const activeActiveByActive = Array(vertexCapacity).fill(0);
  const activeActiveSquareByActive = Array(vertexCapacity).fill(0);
  let activeActiveComplementPairDoubleSum = 0;
  const activeActiveEdgeWeights = new Map();
  const adjacencyByVertex = edgeList ? edgeList.adjacencyByVertex : null;

  if (edgeList) {
    for (const item of edgeList) {
      const from = item.from;
      const to = item.to;
      const fromLink = endpointLink[from];
      const toLink = endpointLink[to];
      if (fromLink === -1 || toLink === -1 || fromLink === to || toLink === from) continue;
      const weight = item.weight;
      const weightSquared = item.weightSquared;

      if ((fromLink === 0 && toLink !== 0) || (fromLink !== 0 && toLink === 0)) {
        const active = fromLink !== 0 ? from : to;
        const free = fromLink === 0 ? from : to;
        activeFreeByActive[active] += weight;
        activeFreeSquareByActive[active] += weightSquared;
        activeFreeByFree[free] += weight;
        activeFreeSquareByFree[free] += weightSquared;
      } else if (fromLink === 0 && toLink === 0) {
        freeFreeByFree[from] += weight;
        freeFreeSquareByFree[from] += weightSquared;
        freeFreeByFree[to] += weight;
        freeFreeSquareByFree[to] += weightSquared;
      } else {
        activeActiveByActive[from] += weight;
        activeActiveByActive[to] += weight;
        activeActiveSquareByActive[from] += weightSquared;
        activeActiveSquareByActive[to] += weightSquared;
        activeActiveEdgeWeights.set(numericEdgeKey(from, to, vertexCapacity), weight);
      }
    }
  } else {
    for (let fromIndex = 0; fromIndex < availableVertices.length; fromIndex++) {
      const from = availableVertices[fromIndex];
      const fromLink = endpointLink[from];
      for (let toIndex = fromIndex + 1; toIndex < availableVertices.length; toIndex++) {
        const to = availableVertices[toIndex];
        const toLink = endpointLink[to];
        if (fromLink === to || toLink === from) continue;
        const weight = edge[from][to];
        const weightSquared = weight * weight;

        if ((fromLink === 0 && toLink !== 0) || (fromLink !== 0 && toLink === 0)) {
          const active = fromLink !== 0 ? from : to;
          const free = fromLink === 0 ? from : to;
          activeFreeByActive[active] += weight;
          activeFreeSquareByActive[active] += weightSquared;
          activeFreeByFree[free] += weight;
          activeFreeSquareByFree[free] += weightSquared;
        } else if (fromLink === 0 && toLink === 0) {
          freeFreeByFree[from] += weight;
          freeFreeSquareByFree[from] += weightSquared;
          freeFreeByFree[to] += weight;
          freeFreeSquareByFree[to] += weightSquared;
        } else {
          activeActiveByActive[from] += weight;
          activeActiveByActive[to] += weight;
          activeActiveSquareByActive[from] += weightSquared;
          activeActiveSquareByActive[to] += weightSquared;
          if (weight !== 0) activeActiveEdgeWeights.set(numericEdgeKey(from, to, vertexCapacity), weight);
        }
      }
    }
  }

  let activeFreeSameActivePairSum = 0;
  let activeFreeSameFreePairSum = 0;
  let activeFreeMateSameFreePairSum = 0;
  let freeFreeTouchingPairSum = 0;
  let activeFreeFreeTouchingPairSum = 0;
  let mixedOpenSharedActivePairSum = 0;
  let activeActiveSharedEndpointPairSum = 0;
  for (const vertex of availableVertices) {
    activeFreeSameActivePairSum += pairProductFromSumAndSquares(activeFreeByActive[vertex], activeFreeSquareByActive[vertex]);
    activeFreeSameFreePairSum += pairProductFromSumAndSquares(activeFreeByFree[vertex], activeFreeSquareByFree[vertex]);
    freeFreeTouchingPairSum += pairProductFromSumAndSquares(freeFreeByFree[vertex], freeFreeSquareByFree[vertex]);
    activeFreeFreeTouchingPairSum += activeFreeByFree[vertex] * freeFreeByFree[vertex];
    mixedOpenSharedActivePairSum += activeActiveByActive[vertex] * activeFreeByActive[vertex];
    activeActiveSharedEndpointPairSum += pairProductFromSumAndSquares(activeActiveByActive[vertex], activeActiveSquareByActive[vertex]);
  }

  const freeVertices = [];
  const activeMatePairs = [];
  for (const vertex of availableVertices) {
    const mate = endpointLink[vertex];
    if (mate === 0) {
      freeVertices.push(vertex);
    } else if (mate > vertex && mate < vertexCapacity && endpointLink[mate] === vertex) {
      activeMatePairs.push([vertex, mate]);
    }
  }

  if (adjacencyByVertex) {
    for (const [active, mate] of activeMatePairs) {
      for (const adjacent of adjacencyByVertex[active]) {
        const free = adjacent.to;
        if (endpointLink[free] !== 0) continue;
        activeFreeMateSameFreePairSum += adjacent.weight * edge[mate][free];
      }
    }
  } else {
    for (const free of freeVertices) {
      for (const [active, mate] of activeMatePairs) {
        activeFreeMateSameFreePairSum += edge[active][free] * edge[mate][free];
      }
    }
  }

  const activeFreePairSum = pairProductFromSumAndSquares(buckets.activeFreeSum, buckets.activeFreeSquareSum);
  const freeFreePairSum = pairProductFromSumAndSquares(buckets.freeFreeSum, buckets.freeFreeSquareSum);
  const activeActivePairSum = pairProductFromSumAndSquares(buckets.activeActiveOpenSum, buckets.activeActiveOpenSquareSum);
  for (const [key, weight] of activeActiveEdgeWeights.entries()) {
    const from = Math.floor(key / vertexCapacity);
    const to = key % vertexCapacity;
    const complementWeight = activeActiveEdgeWeights.get(numericEdgeKey(endpointLink[from], endpointLink[to], vertexCapacity));
    if (complementWeight !== undefined) activeActiveComplementPairDoubleSum += weight * complementWeight;
  }

  buckets.activeFreeTouchingPairSum += activeFreeSameFreePairSum - activeFreeMateSameFreePairSum;
  buckets.activeFreeDisjointPairSum += activeFreePairSum - activeFreeSameActivePairSum - activeFreeSameFreePairSum;
  buckets.freeFreeTouchingPairSum += freeFreeTouchingPairSum;
  buckets.freeFreeDisjointPairSum += freeFreePairSum - freeFreeTouchingPairSum;
  buckets.mixedOpenTouchingPairSum += (buckets.activeActiveOpenSum * buckets.activeFreeSum) - mixedOpenSharedActivePairSum;
  buckets.mixedOpenFreePairSum += buckets.activeActiveOpenSum * buckets.freeFreeSum;
  buckets.activeFreeFreeTouchingPairSum += activeFreeFreeTouchingPairSum;
  buckets.activeFreeFreeDisjointPairSum += (buckets.activeFreeSum * buckets.freeFreeSum) - activeFreeFreeTouchingPairSum;
  buckets.activeActiveOpenPairSum += activeActivePairSum -
    activeActiveSharedEndpointPairSum -
    (0.5 * activeActiveComplementPairDoubleSum);
}

function applyChosenEdge(from, to, edge, endpointLink, state) {
  if (endpointLink[from] === -1 || endpointLink[to] === -1 ||
      endpointLink[from] === to || endpointLink[to] === from) {
    return false;
  }
  state.chosenEdgeTotal += edge[from][to];
  if (state.chosenEdges) state.chosenEdges.push({ from, to, weight: edge[from][to] });

  if (endpointLink[from] !== 0 && endpointLink[to] !== 0) {
    const leftMate = endpointLink[from];
    const rightMate = endpointLink[to];
    endpointLink[leftMate] = rightMate;
    endpointLink[rightMate] = leftMate;
    endpointLink[from] = -1;
    endpointLink[to] = -1;
    state.closedChains -= 1;
    return true;
  }
  if (endpointLink[from] === 0 && endpointLink[to] !== 0) {
    const mate = endpointLink[to];
    endpointLink[from] = mate;
    endpointLink[mate] = from;
    endpointLink[to] = -1;
    state.usedVertices += 1;
    return true;
  }
  if (endpointLink[to] === 0 && endpointLink[from] !== 0) {
    const mate = endpointLink[from];
    endpointLink[to] = mate;
    endpointLink[mate] = to;
    endpointLink[from] = -1;
    state.usedVertices += 1;
    return true;
  }
  endpointLink[from] = to;
  endpointLink[to] = from;
  state.closedChains += 1;
  state.usedVertices += 2;
  return true;
}

function chosenEdgeKeySet(state) {
  const keys = new Set();
  if (!state.chosenEdges) return keys;
  for (const chosen of state.chosenEdges) keys.add(edgeKey(chosen.from, chosen.to));
  return keys;
}

function computeConditionedMeanTourLength(n, endpointLink, state, edge, buckets) {
  const remainingFactor = n - 1 + state.closedChains - state.usedVertices;
  if (remainingFactor === 0) {
    for (let i = 1; i <= n; i++) {
      if (endpointLink[i] === -1) continue;
      for (let j = i + 1; j <= n; j++) {
        if (endpointLink[j] !== -1 && endpointLink[j] === i) return state.chosenEdgeTotal + edge[i][j];
      }
    }
    return state.chosenEdgeTotal;
  }
  return state.chosenEdgeTotal +
    (0.5 / remainingFactor) * buckets.activeActiveOpenSum +
    (1.0 / remainingFactor) * buckets.activeFreeSum +
    (2.0 / remainingFactor) * buckets.freeFreeSum;
}

function computeConditionedVariance(n, state, conditionedMeanTourLength, buckets) {
  const remainingFactor = n - 1 + state.closedChains - state.usedVertices;
  const secondFactor = n - 2 + state.closedChains - state.usedVertices;
  if (remainingFactor <= 0 || secondFactor <= 0) return 0;
  return (0.5 / remainingFactor) * buckets.activeActiveOpenSquareSum +
    (1.0 / remainingFactor) * buckets.activeFreeSquareSum +
    (2.0 / remainingFactor) * buckets.freeFreeSquareSum +
    (1.0 / (remainingFactor * secondFactor)) *
      (0.5 * buckets.activeActiveOpenPairSum +
       buckets.activeFreeTouchingPairSum +
       2.0 * buckets.activeFreeDisjointPairSum +
       4.0 * buckets.freeFreeTouchingPairSum +
       8.0 * buckets.freeFreeDisjointPairSum +
       buckets.mixedOpenTouchingPairSum +
       2.0 * buckets.mixedOpenFreePairSum +
       2.0 * buckets.activeFreeFreeTouchingPairSum +
       4.0 * buckets.activeFreeFreeDisjointPairSum) -
    ((conditionedMeanTourLength - state.chosenEdgeTotal) *
     (conditionedMeanTourLength - state.chosenEdgeTotal));
}

function computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state, edgeList = null) {
  const availableVertices = collectAvailableVertices(endpointLink, n);
  const buckets = accumulateRemainingEdgeBuckets(availableVertices, endpointLink, edge, edgeSquared, edgeList);
  const mean = computeConditionedMeanTourLength(n, endpointLink, state, edge, buckets);
  accumulateVarianceBuckets(availableVertices, endpointLink, edge, buckets, edgeList);
  const variance = computeConditionedVariance(n, state, mean, buckets);
  const remainingFactor = n - 1 + state.closedChains - state.usedVertices;
  const entropy = lnGamma(remainingFactor + 1.0) + (Math.log(2.0) * (state.closedChains - 1));
  return {
    mean,
    variance,
    standardDeviation: Math.sqrt(Math.max(0, variance)),
    remainingFactor,
    entropy
  };
}

function adaptiveBetaForState(n, edge, edgeSquared, endpointLink, state, multiplier, edgeList = null) {
  const stats = computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state, edgeList);
  const beta = stats.variance > 1e-12 ? multiplier / Math.sqrt(stats.variance) : null;
  return { beta, stats };
}

function computeLogZFromStats(stats, beta) {
  return stats.entropy - (beta * stats.mean) + ((beta * beta) * 0.5 * stats.variance);
}

function computeTheoryScore(n, edge, edgeSquared, endpointLink, state, beta, edgeList = null) {
  const stats = computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state, edgeList);
  return computeLogZFromStats(stats, beta);
}

function computeImportanceScore(currentStats, plusStats, beta) {
  const plusLogZ = computeLogZFromStats(plusStats, beta);
  const logOmegaRatio = plusStats.entropy - currentStats.entropy;
  if (!Number.isFinite(logOmegaRatio)) return null;

  if (logOmegaRatio >= -1e-12) {
    return {
      importance: Infinity,
      plusLogZ,
      minusLogZ: -Infinity,
      omegaRatio: 1,
      minusMean: NaN,
      minusVariance: NaN
    };
  }

  const omegaRatio = Math.exp(logOmegaRatio);
  const minusWeight = -Math.expm1(logOmegaRatio);
  if (!(minusWeight > 0) || !Number.isFinite(minusWeight)) return null;

  const currentSecondMoment = currentStats.variance + (currentStats.mean * currentStats.mean);
  const plusSecondMoment = plusStats.variance + (plusStats.mean * plusStats.mean);
  const minusMean = (currentStats.mean - (omegaRatio * plusStats.mean)) / minusWeight;
  const minusSecondMoment = (currentSecondMoment - (omegaRatio * plusSecondMoment)) / minusWeight;
  let minusVariance = minusSecondMoment - (minusMean * minusMean);
  if (minusVariance < 0 && minusVariance > -1e-9) minusVariance = 0;
  if (!Number.isFinite(minusMean) || !Number.isFinite(minusVariance)) return null;
  minusVariance = Math.max(0, minusVariance);

  const minusStats = {
    entropy: currentStats.entropy + Math.log(minusWeight),
    mean: minusMean,
    variance: minusVariance
  };
  const minusLogZ = computeLogZFromStats(minusStats, beta);
  return {
    importance: plusLogZ - minusLogZ,
    plusLogZ,
    minusLogZ,
    omegaRatio,
    minusMean,
    minusVariance
  };
}

function edgeKey(from, to) {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  return `${a}:${b}`;
}

function collectCandidateEdges(n, edge, endpointLink, state, candidateEdgeKeys = null, candidateEdgeList = null) {
  const candidateEdges = [];
  if (candidateEdgeList) {
    for (const item of candidateEdgeList) {
      const from = item.from;
      const to = item.to;
      if (endpointLink[from] === -1 || endpointLink[to] === -1 ||
          endpointLink[from] === to || endpointLink[to] === from ||
          edge[from][to] === 0) {
        continue;
      }
      candidateEdges.push({ from, to });
    }
  } else if (candidateEdgeKeys) {
    for (const key of candidateEdgeKeys) {
      const [from, to] = key.split(":").map(Number);
      if (endpointLink[from] === -1 || endpointLink[to] === -1 ||
          endpointLink[from] === to || endpointLink[to] === from ||
          edge[from][to] === 0) {
        continue;
      }
      candidateEdges.push({ from, to });
    }
  } else if (state.allowedEdges) {
    for (const item of state.allowedEdges) {
      const from = item.from;
      const to = item.to;
      if (endpointLink[from] === -1 || endpointLink[to] === -1 ||
          endpointLink[from] === to || endpointLink[to] === from ||
          edge[from][to] === 0) {
        continue;
      }
      candidateEdges.push({ from, to });
    }
  } else if (state.allowedEdgeKeys) {
    for (const key of state.allowedEdgeKeys) {
      const [from, to] = key.split(":").map(Number);
      if (endpointLink[from] === -1 || endpointLink[to] === -1 ||
          endpointLink[from] === to || endpointLink[to] === from ||
          edge[from][to] === 0) {
        continue;
      }
      candidateEdges.push({ from, to });
    }
  } else {
    for (let i = 1; i <= n - 1; i++) {
      if (endpointLink[i] === -1) continue;
      for (let j = i + 1; j <= n; j++) {
        if (endpointLink[j] === -1 || endpointLink[i] === j || endpointLink[j] === i ||
            (!state.scoreZeroEdges && edge[i][j] === 0)) {
          continue;
        }
        candidateEdges.push({ from: i, to: j });
      }
    }
  }
  return candidateEdges;
}

function candidateClassInfo(endpointLink, from, to) {
  const fromFree = endpointLink[from] === 0;
  const toFree = endpointLink[to] === 0;
  if (fromFree && toFree) return { name: "independent/free-free", weight: 2.0 };
  if (fromFree || toFree) return { name: "neighbor/active-free", weight: 1.0 };
  return { name: "chain-end/active-active", weight: 0.5 };
}

function scoreCandidateEdge(n, edge, edgeSquared, endpointLink, state, beta, candidate, currentStats, scoreMethod, momentEdgeList) {
  const trialLinks = endpointLink.slice();
  const trialState = { ...state, chosenEdges: null };
  if (!applyChosenEdge(candidate.from, candidate.to, edge, trialLinks, trialState)) return null;
  const classInfo = candidateClassInfo(endpointLink, candidate.from, candidate.to);
  const plusStats = computeConditionedStateStats(n, edge, edgeSquared, trialLinks, trialState, momentEdgeList);
  let plusLogZ = null;
  let logScore = null;
  let importanceInfo = null;
  if (scoreMethod === "importance") {
    importanceInfo = computeImportanceScore(currentStats, plusStats, beta);
    if (!importanceInfo) return null;
    plusLogZ = importanceInfo.plusLogZ;
    logScore = importanceInfo.importance;
  } else {
    plusLogZ = computeLogZFromStats(plusStats, beta);
    logScore = plusLogZ;
  }
  if (Number.isNaN(logScore) || logScore === -Infinity) return null;
  return {
    logScore,
    plusLogZ,
    importance: importanceInfo ? importanceInfo.importance : null,
    minusLogZ: importanceInfo ? importanceInfo.minusLogZ : null,
    omegaRatio: importanceInfo ? importanceInfo.omegaRatio : null,
    scoreMethod,
    from: candidate.from,
    to: candidate.to,
    className: classInfo.name,
    classWeight: classInfo.weight
  };
}

function rankScoringEdges(n, edge, edgeSquared, endpointLink, state, beta, candidateEdgeKeys = null, options = {}) {
  const ranked = [];
  const scoreMethod = options.scoreMethod === "importance" ? "importance" : "omega";
  const momentEdgeList = options.momentEdgeList || null;
  const candidateEdgeList = options.candidateEdgeList || null;
  let candidateEdges = null;
  if (options.preferredCandidateEdgeList && options.preferredCandidateEdgeList.length > 0) {
    candidateEdges = collectCandidateEdges(n, edge, endpointLink, state, null, options.preferredCandidateEdgeList);
    if (candidateEdges.length === 0) candidateEdges = null;
  }
  const currentStats = scoreMethod === "importance"
    ? (options.currentStats || computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state, momentEdgeList))
    : null;
  if (!candidateEdges) {
    candidateEdges = collectCandidateEdges(n, edge, endpointLink, state, candidateEdgeKeys, candidateEdgeList);
  }
  for (const candidate of candidateEdges) {
    const scored = scoreCandidateEdge(n, edge, edgeSquared, endpointLink, state, beta, candidate, currentStats, scoreMethod, momentEdgeList);
    if (scored) ranked.push(scored);
  }
  if (ranked.length === 0) return ranked;

  const infiniteWinners = ranked.filter(candidate => candidate.logScore === Infinity);
  if (infiniteWinners.length > 0) {
    for (const candidate of ranked) {
      candidate.probability = candidate.logScore === Infinity ? 1 / infiniteWinners.length : 0;
      candidate.score = candidate.probability;
      candidate.omega = infiniteWinners.length;
      candidate.logOmega = Infinity;
      candidate.maxLogScore = Infinity;
    }
    ranked.sort((a, b) => b.probability - a.probability);
    return ranked;
  }

  const maxLogScore = Math.max(...ranked.map(candidate => candidate.logScore));
  let omega = 0;
  for (const candidate of ranked) {
    candidate.omegaWeight = Math.exp(candidate.logScore - maxLogScore);
    omega += candidate.omegaWeight;
  }
  const logOmega = maxLogScore + Math.log(omega);
  for (const candidate of ranked) {
    candidate.probability = candidate.omegaWeight / omega;
    candidate.score = candidate.probability;
    candidate.omega = omega;
    candidate.logOmega = logOmega;
    candidate.maxLogScore = maxLogScore;
  }

  ranked.sort((a, b) => b.probability - a.probability);
  return ranked;
}

function formatCandidateChoice(candidate) {
  const classText = candidate.className
    ? ` class ${candidate.className}`
    : "";
  const scoreText = candidate.scoreMethod === "importance"
    ? `importance ${formatNumber(candidate.importance)} plus-lnZ ${formatNumber(candidate.plusLogZ)} minus-lnZ ${formatNumber(candidate.minusLogZ)}`
    : `log-score ${formatNumber(candidate.logScore)}`;
  return `probability ${formatNumber(candidate.probability)} ${scoreText}${classText}`;
}

function findBestScoringEdge(n, edge, edgeSquared, endpointLink, state, beta, candidateEdgeKeys = null, options = {}) {
  const scoreMethod = options.scoreMethod === "importance" ? "importance" : "omega";
  const momentEdgeList = options.momentEdgeList || null;
  const candidateEdgeList = options.candidateEdgeList || null;
  const currentStats = scoreMethod === "importance"
    ? (options.currentStats || computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state, momentEdgeList))
    : null;
  const candidateEdges = collectCandidateEdges(n, edge, endpointLink, state, candidateEdgeKeys, candidateEdgeList);
  let best = null;
  let maxLogScore = -Infinity;
  let omega = 0;
  let infiniteWinners = 0;

  for (const candidate of candidateEdges) {
    const scored = scoreCandidateEdge(n, edge, edgeSquared, endpointLink, state, beta, candidate, currentStats, scoreMethod, momentEdgeList);
    if (!scored) continue;

    if (scored.logScore === Infinity) {
      infiniteWinners += 1;
      if (!best || best.logScore !== Infinity) best = scored;
      continue;
    }
    if (infiniteWinners > 0) continue;

    if (!best || scored.logScore > maxLogScore) {
      omega = omega === 0 ? 1 : (omega * Math.exp(maxLogScore - scored.logScore)) + 1;
      maxLogScore = scored.logScore;
      best = scored;
    } else {
      omega += Math.exp(scored.logScore - maxLogScore);
    }
  }

  if (best) {
    if (best.logScore === Infinity) {
      best.probability = 1 / infiniteWinners;
      best.score = best.probability;
      best.omega = infiniteWinners;
      best.logOmega = Infinity;
      best.maxLogScore = Infinity;
    } else {
      best.probability = Math.exp(best.logScore - maxLogScore) / omega;
      best.score = best.probability;
      best.omega = omega;
      best.logOmega = maxLogScore + Math.log(omega);
      best.maxLogScore = maxLogScore;
    }
    return best;
  }
  return { score: 0, probability: 0, logScore: -Infinity, from: 0, to: 0 };
}

function findForcedFinalEdge(n, endpointLink, edge) {
  for (let i = 1; i <= n; i++) {
    if (endpointLink[i] === -1) continue;
    for (let j = i + 1; j <= n; j++) {
      if (endpointLink[j] !== -1 && endpointLink[i] === j && endpointLink[j] === i) {
        return { exists: true, from: i, to: j, weight: edge[i][j] };
      }
    }
  }
  return { exists: false, from: 0, to: 0, weight: 0 };
}

function findBestCompletionEdge(n, endpointLink, edge) {
  let best = { from: 0, to: 0, weight: Infinity };
  for (let i = 1; i <= n - 1; i++) {
    if (endpointLink[i] === -1) continue;
    for (let j = i + 1; j <= n; j++) {
      if (endpointLink[j] === -1 || endpointLink[i] === j || endpointLink[j] === i) continue;
      const weight = edge[i][j];
      if (weight < best.weight) best = { from: i, to: j, weight };
    }
  }
  return best;
}

function completeOpenTourWithNeutralEdges(edge, n, endpointLink, state) {
  const result = { addedEdges: 0, zeroEdges: 0, nonzeroEdges: 0, addedTotal: 0 };
  let guard = 0;
  while (n - state.usedVertices + state.closedChains - 1 > 0) {
    const best = findBestCompletionEdge(n, endpointLink, edge);
    if (!best.from) break;
    if (!applyChosenEdge(best.from, best.to, edge, endpointLink, state)) break;
    result.addedEdges += 1;
    result.addedTotal += best.weight;
    if (best.weight === 0) result.zeroEdges += 1;
    else result.nonzeroEdges += 1;
    guard++;
    if (guard > n + 2) throw new Error("Neutral completion guard stopped a loop that exceeded n steps.");
  }
  return result;
}

function selectedEdgesToTourOrder(selectedEdges, n) {
  const adjacency = Array.from({ length: n + 1 }, () => []);
  for (const chosen of selectedEdges) {
    if (!chosen || chosen.from < 1 || chosen.from > n || chosen.to < 1 || chosen.to > n || chosen.from === chosen.to) {
      return { valid: false, reason: "selected edge list contains an invalid edge" };
    }
    adjacency[chosen.from].push(chosen.to);
    adjacency[chosen.to].push(chosen.from);
  }

  for (let vertex = 1; vertex <= n; vertex++) {
    if (adjacency[vertex].length !== 2) {
      return { valid: false, reason: `vertex ${vertex} has tour degree ${adjacency[vertex].length}` };
    }
  }

  const order = [1];
  const seen = new Set([1]);
  let previous = 0;
  let current = 1;
  for (let step = 1; step < n; step++) {
    const first = adjacency[current][0];
    const second = adjacency[current][1];
    const next = first === previous ? second : first;
    if (next === 1 || seen.has(next)) return { valid: false, reason: "selected edges close before visiting every vertex" };
    order.push(next);
    seen.add(next);
    previous = current;
    current = next;
  }

  if (!adjacency[current].includes(1)) return { valid: false, reason: "selected edges do not close into one cycle" };
  return { valid: true, order };
}

function cycleCost(order, edge) {
  let total = 0;
  for (let i = 0; i < order.length; i++) total += edge[order[i]][order[(i + 1) % order.length]];
  return total;
}

function orientation(a, b, c) {
  const value = ((b.x - a.x) * (c.y - a.y)) - ((b.y - a.y) * (c.x - a.x));
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : -1;
}

function euclideanSegmentsCross(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC !== 0 && abD !== 0 && cdA !== 0 && cdB !== 0 && abC !== abD && cdA !== cdB;
}

function uncrossEuclideanTour(order, edge, points) {
  const next = order.slice();
  const n = next.length;
  let improvements = 0;
  let passes = 0;
  let improved = true;

  while (improved && passes < n * n) {
    improved = false;
    passes += 1;
    for (let i = 0; i < n - 1 && !improved; i++) {
      const aIndex = next[i];
      const bIndex = next[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const cIndex = next[j];
        const dIndex = next[(j + 1) % n];
        if (!euclideanSegmentsCross(points[aIndex - 1], points[bIndex - 1], points[cIndex - 1], points[dIndex - 1])) continue;
        reverseOrderSegment(next, i + 1, j);
        improvements += 1;
        improved = true;
        break;
      }
    }
  }

  return {
    order: next,
    improvements,
    passes,
    totalTourCost: cycleCost(next, edge)
  };
}

function reverseOrderSegment(order, left, right) {
  while (left < right) {
    const saved = order[left];
    order[left] = order[right];
    order[right] = saved;
    left++;
    right--;
  }
}

function segmentEndpoints(first, last, reversed) {
  return reversed ? { first: last, last: first } : { first, last };
}

function cycleSegment(order, start, end) {
  if (start <= end) return order.slice(start, end + 1);
  return order.slice(start).concat(order.slice(0, end + 1));
}

function orientedSegment(segment, reversed) {
  const copy = segment.slice();
  if (reversed) copy.reverse();
  return copy;
}

function applyThreeOptMove(order, move) {
  const segments = [
    cycleSegment(order, move.i + 1, move.j),
    cycleSegment(order, move.j + 1, move.k),
    cycleSegment(order, (move.k + 1) % order.length, move.i)
  ];
  const next = [];
  for (let index = 0; index < move.permutation.length; index++) {
    next.push(...orientedSegment(segments[move.permutation[index]], move.reversed[index]));
  }
  return next;
}

function findTargetedThreeOptMove(order, edge, n) {
  const badEdges = [];
  for (let i = 0; i < n; i++) {
    if (edge[order[i]][order[(i + 1) % n]] >= 0) badEdges.push(i);
  }
  if (badEdges.length === 0 || badEdges.length > 24) return null;

  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0]
  ];
  let bestMove = null;
  const seenTriples = new Set();

  for (const badIndex of badEdges) {
    for (let second = 0; second < n; second++) {
      if (second === badIndex) continue;
      for (let third = second + 1; third < n; third++) {
        if (third === badIndex) continue;
        const cuts = [badIndex, second, third].sort((a, b) => a - b);
        const i = cuts[0], j = cuts[1], k = cuts[2];
        if (j <= i + 1 || k <= j + 1 || (i === 0 && k === n - 1)) continue;
        const key = `${i}:${j}:${k}`;
        if (seenTriples.has(key)) continue;
        seenTriples.add(key);

        const originalBoundary =
          edge[order[i]][order[(i + 1) % n]] +
          edge[order[j]][order[(j + 1) % n]] +
          edge[order[k]][order[(k + 1) % n]];
        const segmentInfo = [
          { first: order[i + 1], last: order[j] },
          { first: order[j + 1], last: order[k] },
          { first: order[(k + 1) % n], last: order[i] }
        ];

        for (const permutation of permutations) {
          for (let mask = 0; mask < 8; mask++) {
            const reversed = [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)];
            const firstSegment = segmentEndpoints(
              segmentInfo[permutation[0]].first,
              segmentInfo[permutation[0]].last,
              reversed[0]
            );
            const secondSegment = segmentEndpoints(
              segmentInfo[permutation[1]].first,
              segmentInfo[permutation[1]].last,
              reversed[1]
            );
            const thirdSegment = segmentEndpoints(
              segmentInfo[permutation[2]].first,
              segmentInfo[permutation[2]].last,
              reversed[2]
            );
            const newBoundary =
              edge[firstSegment.last][secondSegment.first] +
              edge[secondSegment.last][thirdSegment.first] +
              edge[thirdSegment.last][firstSegment.first];
            const delta = newBoundary - originalBoundary;
            if (delta < -1e-9 && (!bestMove || delta < bestMove.delta)) {
              bestMove = { i, j, k, permutation: permutation.slice(), reversed, delta };
            }
          }
        }
      }
    }
  }

  return bestMove;
}

function repairTourWithTwoOpt(edge, n, selectedEdges, maxPasses) {
  const passes = Math.max(0, Math.floor(maxPasses));
  const built = selectedEdgesToTourOrder(selectedEdges, n);
  if (!built.valid || passes === 0) {
    return {
      attempted: passes > 0,
      valid: built.valid,
      reason: built.reason || "repair disabled",
      initialCost: NaN,
      totalTourCost: NaN,
      improvements: 0,
      passesUsed: 0
    };
  }

  const order = built.order.slice();
  let totalTourCost = cycleCost(order, edge);
  const initialCost = totalTourCost;
  let improvements = 0;
  let twoOptImprovements = 0;
  let threeOptImprovements = 0;
  let passesUsed = 0;

  for (let pass = 0; pass < passes; pass++) {
    let bestDelta = 0;
    let bestLeft = -1;
    let bestRight = -1;

    for (let i = 0; i < n - 1; i++) {
      const a = order[i];
      const b = order[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const c = order[j];
        const d = order[(j + 1) % n];
        const before = edge[a][b] + edge[c][d];
        const after = edge[a][c] + edge[b][d];
        const delta = after - before;
        if (delta < bestDelta - 1e-9) {
          bestDelta = delta;
          bestLeft = i + 1;
          bestRight = j;
        }
      }
    }

    passesUsed += 1;
    if (bestLeft >= 0) {
      reverseOrderSegment(order, bestLeft, bestRight);
      totalTourCost += bestDelta;
      improvements += 1;
      twoOptImprovements += 1;
      if (Math.abs(totalTourCost + n) < 1e-9) break;
      continue;
    }

    const threeOptMove = findTargetedThreeOptMove(order, edge, n);
    if (!threeOptMove) break;
    const nextOrder = applyThreeOptMove(order, threeOptMove);
    order.length = 0;
    order.push(...nextOrder);
    totalTourCost += threeOptMove.delta;
    improvements += 1;
    threeOptImprovements += 1;
    if (Math.abs(totalTourCost + n) < 1e-9) break;
  }

  return {
    attempted: true,
    valid: true,
    reason: "",
    initialCost,
    totalTourCost,
    improvements,
    twoOptImprovements,
    threeOptImprovements,
    passesUsed,
    order
  };
}

function tourOrderToEdges(order, edge) {
  if (!order || order.length === 0) return [];
  const edges = [];
  for (let index = 0; index < order.length; index++) {
    const from = order[index];
    const to = order[(index + 1) % order.length];
    edges.push({ from, to, weight: edge[from][to] });
  }
  return edges;
}

function rotateOrderToSmallest(order) {
  if (!order || order.length === 0) return [];
  let smallestIndex = 0;
  for (let index = 1; index < order.length; index++) {
    if (order[index] < order[smallestIndex]) smallestIndex = index;
  }
  return order.slice(smallestIndex).concat(order.slice(0, smallestIndex));
}

function compareOrderLexicographic(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function canonicalTourOrder(order) {
  const forward = rotateOrderToSmallest(order);
  const backward = rotateOrderToSmallest(order.slice().reverse());
  return compareOrderLexicographic(forward, backward) <= 0 ? forward : backward;
}

function canonicalTourSignature(order) {
  return canonicalTourOrder(order).join(":");
}

function chosenEdgesSignature(chosenEdges) {
  if (!chosenEdges || chosenEdges.length === 0) return "";
  return chosenEdges
    .map(edge => edgeKey(edge.from, edge.to))
    .sort()
    .join("|");
}

function candidateTourSignature(candidate) {
  if (candidate.tourOrder && candidate.tourOrder.length > 0) return canonicalTourSignature(candidate.tourOrder);
  if (candidate.chosenEdges && candidate.chosenEdges.length > 0) return chosenEdgesSignature(candidate.chosenEdges);
  return `branch:${candidate.exploredIndex}`;
}

function formatTourOrder(order) {
  if (!order || order.length === 0) return "(no completed tour order)";
  const canonical = canonicalTourOrder(order);
  return `${canonical.join(" -> ")} -> ${canonical[0]}`;
}

function formatChosenEdgeList(chosenEdges) {
  if (!chosenEdges || chosenEdges.length === 0) return "(no completed edge witness)";
  return chosenEdges
    .slice()
    .sort((a, b) => Math.min(a.from, a.to) - Math.min(b.from, b.to) ||
      Math.max(a.from, a.to) - Math.max(b.from, b.to))
    .map(edge => `(${Math.min(edge.from, edge.to)},${Math.max(edge.from, edge.to)})`)
    .join(" ");
}

function formatMinimumTourWitness(candidate, index) {
  const costText = formatNumber(candidate.totalTourCost);
  const branchText = Number.isFinite(candidate.exploredIndex) ? `branch ${candidate.exploredIndex}` : "branch ?";
  if (candidate.tourOrder && candidate.tourOrder.length > 0) {
    return `${index}. cost ${costText}, ${branchText}: ${formatTourOrder(candidate.tourOrder)}`;
  }
  return `${index}. cost ${costText}, ${branchText}: ${formatChosenEdgeList(candidate.chosenEdges)}`;
}

function appendTrackingTourWitnesses(lines, result, kind = "hc") {
  const candidates = [];
  const seen = new Set();
  const addCandidate = candidate => {
    if (!candidate) return;
    if ((!candidate.tourOrder || candidate.tourOrder.length === 0) &&
        (!candidate.chosenEdges || candidate.chosenEdges.length === 0)) return;
    const signature = candidateTourSignature(candidate);
    if (seen.has(signature)) return;
    seen.add(signature);
    candidates.push(candidate);
  };

  (result.bestFinals || []).forEach(addCandidate);
  addCandidate(result);
  if (candidates.length === 0) return;

  append(lines);
  if (kind === "hc" && result.hamiltonianFound) {
    append(lines, `HC tours found = ${candidates.length}`);
    append(lines, "HC tour witnesses:");
  } else if (kind === "tsp") {
    append(lines, `best tours found = ${candidates.length}`);
    append(lines, "Best tour witnesses:");
  } else {
    append(lines, `tour witnesses found = ${candidates.length}`);
    append(lines, "Tour witnesses:");
  }
  candidates.forEach((candidate, index) => append(lines, formatMinimumTourWitness(candidate, index + 1)));
}

function cloneSolverState(state) {
  return {
    ...state,
    chosenEdges: state.chosenEdges ? state.chosenEdges.slice() : [],
    vcSelectedVertices: state.vcSelectedVertices ? new Set(state.vcSelectedVertices) : undefined,
    vcRejectedVertices: state.vcRejectedVertices ? new Set(state.vcRejectedVertices) : undefined
  };
}

function remainingChoices(n, state) {
  return n - state.usedVertices + state.closedChains - 1;
}

function resolveStepBeta(n, edge, edgeSquared, endpointLink, state, options, lastAdaptiveBeta) {
  if (!options.adaptiveBeta) return { beta: options.effectiveBeta, lastAdaptiveBeta, standardDeviation: null, currentStats: null };
  const current = adaptiveBetaForState(n, edge, edgeSquared, endpointLink, state, options.betaMultiplier, options.momentEdgeList || null);
  let nextBeta = lastAdaptiveBeta;
  if (current.beta !== null && Number.isFinite(current.beta)) nextBeta = current.beta;
  return {
    beta: nextBeta,
    lastAdaptiveBeta: nextBeta,
    standardDeviation: current.stats.standardDeviation,
    currentStats: current.stats
  };
}

function finishTourFromState(edge, n, endpointLink, state, options) {
  const lines = options.compactOutput ? null : [];
  if (state.invalid) {
    append(lines, `Solver branch stopped: ${state.invalidReason || "forced propagation contradiction"}`);
    return {
      lines: lines || [],
      totalTourCost: NaN,
      partialTourCost: state.chosenEdgeTotal,
      hamiltonianFound: false,
      chosenEdges: state.chosenEdges ? state.chosenEdges.slice() : [],
      tourOrder: null
    };
  }
  if (options.completeWithNeutralEdges && remainingChoices(n, state) > 0) {
    const completion = completeOpenTourWithNeutralEdges(edge, n, endpointLink, state);
    append(lines, "Neutral completion before repair:");
    append(lines, `completion edges added = ${completion.addedEdges}`);
    append(lines, `zero placeholder edges added = ${completion.zeroEdges}`);
    append(lines, `nonzero completion edges added = ${completion.nonzeroEdges}`);
    append(lines, `completion edge total = ${formatNumber(completion.addedTotal)}`);
  }

  const forced = findForcedFinalEdge(n, endpointLink, edge);
  let totalTourCost = state.chosenEdgeTotal;
  if (forced.exists) {
    if (options.requireNonzeroFinalEdge && forced.weight === 0) {
      append(lines, "Final forced edge is a zero-weight non-edge, so this HC branch is not a complete HC tour.");
      return {
        lines: lines || [],
        totalTourCost: NaN,
        partialTourCost: state.chosenEdgeTotal,
        hamiltonianFound: false,
        chosenEdges: state.chosenEdges ? state.chosenEdges.slice() : [],
        tourOrder: null
      };
    }
    append(lines, `The biggest probability is 1 at Edge[${forced.from}][${forced.to}].`);
    totalTourCost += forced.weight;
    if (state.chosenEdges) state.chosenEdges.push({ from: forced.from, to: forced.to, weight: forced.weight });
  }
  let chosenEdges = state.chosenEdges ? state.chosenEdges.slice() : [];
  let builtTour = chosenEdges.length > 0 ? selectedEdgesToTourOrder(chosenEdges, n) : { valid: false };
  let tourOrder = builtTour.valid ? builtTour.order.slice() : null;

  if (options.removeEuclideanCrossings && options.euclideanPoints && tourOrder) {
    const uncrossed = uncrossEuclideanTour(tourOrder, edge, options.euclideanPoints);
    if (uncrossed.improvements > 0) {
      append(lines, "Euclidean no-crossing cleanup:");
      append(lines, `crossing removals = ${uncrossed.improvements}`);
      totalTourCost = uncrossed.totalTourCost;
      tourOrder = uncrossed.order.slice();
      chosenEdges = tourOrderToEdges(tourOrder, edge);
    }
  }

  const repairPasses = Math.max(0, Math.floor(Number(options.repairPasses || 0)));
  if (repairPasses > 0) {
    const repair = repairTourWithTwoOpt(edge, n, state.chosenEdges, repairPasses);
    append(lines, "2-opt/targeted 3-opt tour repair:");
    append(lines, `repair passes requested = ${repairPasses}`);
    if (repair.valid) {
      append(lines, `tour cost before repair = ${formatNumber(repair.initialCost)}`);
      append(lines, `repair passes used = ${repair.passesUsed}`);
      append(lines, `repair improvements accepted = ${repair.improvements}`);
      append(lines, `2-opt improvements = ${repair.twoOptImprovements}`);
      append(lines, `targeted 3-opt improvements = ${repair.threeOptImprovements}`);
      append(lines, `tour cost after repair = ${formatNumber(repair.totalTourCost)}`);
      if (repair.totalTourCost < totalTourCost) {
        totalTourCost = repair.totalTourCost;
        tourOrder = repair.order ? repair.order.slice() : tourOrder;
        chosenEdges = tourOrder ? tourOrderToEdges(tourOrder, edge) : chosenEdges;
      }
    } else {
      append(lines, `repair skipped = ${repair.reason}`);
    }
  }

  return {
    lines: lines || [],
    totalTourCost,
    hamiltonianFound: Math.abs(totalTourCost + n) < 1e-9,
    chosenEdges,
    tourOrder
  };
}

function appendTraceLine(trace, line) {
  if (trace.lines.length < 80) trace.lines.push(line);
  else trace.omitted += 1;
}

function scoreRegret(best, candidate) {
  if (best.logScore === Infinity && candidate.logScore === Infinity) return 0;
  if (best.logScore === Infinity) return Infinity;
  const regret = best.logScore - candidate.logScore;
  if (!Number.isFinite(regret)) return 0;
  return Math.max(0, regret);
}

function countPotentialSearchEdges(edge, n, state) {
  if (state.allowedEdgeKeys) return state.allowedEdgeKeys.size;
  let count = 0;
  for (let i = 1; i <= n - 1; i++) {
    for (let j = i + 1; j <= n; j++) {
      if (state.scoreZeroEdges || edge[i][j] !== 0) count++;
    }
  }
  return count;
}

function selectSmartBacktrackAlternatives(ranked, maxAlternatives, options = {}) {
  if (ranked.length <= 1 || maxAlternatives <= 0) return [];
  const tolerance = Number.isFinite(options.smartBacktrackLogTolerance)
    ? Math.max(0, options.smartBacktrackLogTolerance)
    : 1e-9;
  const probabilityTolerance = Number.isFinite(options.smartBacktrackProbabilityTolerance)
    ? Math.max(0, options.smartBacktrackProbabilityTolerance)
    : 1e-12;
  const best = ranked[0];
  const alternatives = [];

  for (let optionIndex = 1; optionIndex < ranked.length && alternatives.length < maxAlternatives; optionIndex++) {
    const candidate = ranked[optionIndex];
    const regret = scoreRegret(best, candidate);
    const probabilityGap = Math.abs(best.probability - candidate.probability);
    if (regret <= tolerance || probabilityGap <= probabilityTolerance) {
      alternatives.push({ candidate, optionIndex, regret });
    }
  }
  for (let optionIndex = 1; optionIndex < ranked.length && alternatives.length < maxAlternatives; optionIndex++) {
    if (alternatives.some(item => item.optionIndex === optionIndex)) continue;
    const candidate = ranked[optionIndex];
    alternatives.push({ candidate, optionIndex, regret: scoreRegret(best, candidate) });
  }
  return alternatives;
}

function sortedNumberSetSignature(values) {
  if (!values || values.size === 0) return "";
  return Array.from(values).sort((a, b) => a - b).join(",");
}

function numberSetsDiffer(left, right) {
  const a = left || new Set();
  const b = right || new Set();
  if (a.size !== b.size) return true;
  for (const value of a) if (!b.has(value)) return true;
  return false;
}

function vertexCoverConsequenceSignature(beforeState, afterState, meta = null) {
  const beforeSelected = beforeState.vcSelectedVertices || new Set();
  const beforeRejected = beforeState.vcRejectedVertices || new Set();
  const afterSelected = afterState.vcSelectedVertices || new Set();
  const afterRejected = afterState.vcRejectedVertices || new Set();
  if (!numberSetsDiffer(beforeSelected, afterSelected) &&
      !numberSetsDiffer(beforeRejected, afterRejected)) {
    return null;
  }
  if (meta && meta.witnessKind === "sat") {
    return satAssignmentConsequenceSignature(afterState, meta);
  }
  if (meta && meta.witnessKind === "clique") {
    return `clique:${sortedNumberSetSignature(afterRejected)}|notClique:${sortedNumberSetSignature(afterSelected)}`;
  }
  return `selected:${sortedNumberSetSignature(afterSelected)}|rejected:${sortedNumberSetSignature(afterRejected)}`;
}

function satAssignmentConsequenceSignature(state, meta) {
  const literalByVertex = meta.satLiteralByVertex || [];
  const variableCount = Math.max(0, Math.floor(Number(meta.satVariableCount || 0)));
  if (variableCount === 0) return null;
  const assignment = Array(variableCount + 1).fill("");

  const setValue = (variable, value) => {
    if (variable < 1 || variable > variableCount) return;
    if (assignment[variable] && assignment[variable] !== value) {
      assignment[variable] = "conflict";
      return;
    }
    assignment[variable] = value;
  };

  const selected = state.vcSelectedVertices || new Set();
  for (const vertex of selected) {
    const literal = literalByVertex[vertex];
    if (!literal) continue;
    setValue(literal.variable, literal.sign > 0 ? "true" : "false");
  }

  const rejected = state.vcRejectedVertices || new Set();
  for (const vertex of rejected) {
    const literal = literalByVertex[vertex];
    if (!literal) continue;
    setValue(literal.variable, literal.sign > 0 ? "false" : "true");
  }

  const parts = [];
  for (let variable = 1; variable <= variableCount; variable++) {
    if (assignment[variable]) parts.push(`x${variable}=${assignment[variable]}`);
  }
  return parts.length > 0 ? `sat:${parts.join(",")}` : null;
}

function vertexCoverPatternTouchesSatLiteral(pattern, meta) {
  const literalByVertex = meta.satLiteralByVertex || [];
  return Boolean(literalByVertex[pattern.rejectedVertex] || literalByVertex[pattern.coveringVertex]);
}

function vertexCoverPatternIsSatVariablePair(pattern, meta) {
  const literalByVertex = meta.satLiteralByVertex || [];
  const rejected = literalByVertex[pattern.rejectedVertex];
  const covering = literalByVertex[pattern.coveringVertex];
  return Boolean(rejected &&
    covering &&
    rejected.variable === covering.variable &&
    rejected.sign !== covering.sign);
}

function vertexCoverDecisionEdge(candidate, meta) {
  if (!meta || !candidate) return false;
  const key = edgeKey(candidate.from, candidate.to);
  if (meta.witnessKind === "sat" && meta.satDecisionEdgeKeys) {
    return meta.satDecisionEdgeKeys.has(key);
  }
  if (meta.rejectionDecisionEdgeKeys) return meta.rejectionDecisionEdgeKeys.has(key);
  return meta.rejectionPatterns.some(pattern => {
    if (!pattern.crossKeys.includes(key)) return false;
    return meta.witnessKind !== "sat" || vertexCoverPatternTouchesSatLiteral(pattern, meta);
  });
}

function prepareBacktrackBranch(edge, n, branch, alternativeInfo, searchOptions) {
  const alternative = alternativeInfo.candidate;
  const altEndpointLink = branch.endpointLink.slice();
  const altState = cloneSolverState(branch.state);
  if (!applyChosenEdge(alternative.from, alternative.to, edge, altEndpointLink, altState)) return null;
  const forced = propagateConfiguredForcedEdges(edge, n, altEndpointLink, altState, searchOptions);
  if (altState.invalid) return null;
  return {
    alternativeInfo,
    alternative,
    endpointLink: altEndpointLink,
    state: altState,
    forced,
    vcConsequenceSignature: searchOptions.vertexCoverPropagation
      ? vertexCoverConsequenceSignature(branch.state, altState, searchOptions.vertexCoverPropagation)
      : null
  };
}

function trackingStateSignature(endpointLink, state) {
  const chosenTotal = Number.isFinite(state.chosenEdgeTotal) ? formatNumber(state.chosenEdgeTotal) : String(state.chosenEdgeTotal);
  return `${endpointLink.join(",")}|used:${state.usedVertices}|chains:${state.closedChains}|cost:${chosenTotal}`;
}

function buildBacktrackBranches(ranked, maxAlternatives, branch, edge, n, searchOptions) {
  const defaultAlternatives = selectSmartBacktrackAlternatives(ranked, maxAlternatives, searchOptions);
  if (!searchOptions.vertexCoverPropagation) {
    const branches = [];
    const seenStates = new Set();
    const bestPreview = prepareBacktrackBranch(edge, n, branch, { candidate: ranked[0], optionIndex: 0, regret: 0 }, searchOptions);
    if (bestPreview) seenStates.add(trackingStateSignature(bestPreview.endpointLink, bestPreview.state));
    for (const alternativeInfo of defaultAlternatives) {
      if (branches.length >= maxAlternatives) break;
      const prepared = prepareBacktrackBranch(edge, n, branch, alternativeInfo, searchOptions);
      if (!prepared) continue;
      const signature = trackingStateSignature(prepared.endpointLink, prepared.state);
      if (seenStates.has(signature)) continue;
      seenStates.add(signature);
      branches.push(prepared);
    }
    return branches;
  }

  const best = ranked[0];
  const meta = searchOptions.vertexCoverPropagation;
  const seenConsequences = new Set();
  const bestPreview = vertexCoverDecisionEdge(best, meta)
    ? prepareBacktrackBranch(edge, n, branch, { candidate: best, optionIndex: 0, regret: 0 }, searchOptions)
    : null;
  if (bestPreview && bestPreview.vcConsequenceSignature) {
    seenConsequences.add(bestPreview.vcConsequenceSignature);
  }

  const keyBranches = [];
  const scanLimit = meta.witnessKind === "clique"
    ? ranked.length
    : meta.witnessKind === "sat"
      ? Math.min(ranked.length, 1 + Math.max(maxAlternatives * 24, 64))
    : Math.min(ranked.length, 1 + Math.max(maxAlternatives * 12, 16));
  for (let optionIndex = 1; optionIndex < scanLimit; optionIndex++) {
    const candidate = ranked[optionIndex];
    if (!vertexCoverDecisionEdge(candidate, meta)) continue;
    const alternativeInfo = { candidate, optionIndex, regret: scoreRegret(best, candidate) };
    const prepared = prepareBacktrackBranch(edge, n, branch, alternativeInfo, searchOptions);
    if (!prepared) continue;

    if (!prepared.vcConsequenceSignature ||
        seenConsequences.has(prepared.vcConsequenceSignature)) continue;
    seenConsequences.add(prepared.vcConsequenceSignature);
    keyBranches.push(prepared);
    if (keyBranches.length >= maxAlternatives) break;
  }

  if (keyBranches.length >= maxAlternatives) return keyBranches;
  if (meta.witnessKind === "sat" && keyBranches.length > 0) return keyBranches;
  for (const alternativeInfo of defaultAlternatives) {
    if (keyBranches.length >= maxAlternatives) break;
    const prepared = prepareBacktrackBranch(edge, n, branch, alternativeInfo, searchOptions);
    if (!prepared) continue;
    if (prepared.vcConsequenceSignature &&
        seenConsequences.has(prepared.vcConsequenceSignature)) continue;
    if (prepared.vcConsequenceSignature) seenConsequences.add(prepared.vcConsequenceSignature);
    keyBranches.push(prepared);
  }
  return keyBranches.slice(0, maxAlternatives);
}

function runScoreGuidedBacktracking(edge, n, edgeSquared, rootEndpointLink, rootState, searchOptions) {
  const includeTrace = !searchOptions.compactOutput;
  const requestedTries = Math.max(1, Math.floor(searchOptions.backtrackLimit));
  const alternativesPerSplit = Math.max(1, Math.floor(searchOptions.alternativesPerSplit || 2));
  const initialEdgeCount = countPotentialSearchEdges(edge, n, rootState);
  const polynomialBranchCap = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, initialEdgeCount * initialEdgeCount));
  const maxTries = Math.min(requestedTries, polynomialBranchCap);
  const queue = [{
    endpointLink: rootEndpointLink.slice(),
    state: cloneSolverState(rootState),
    penalty: 0,
    lastAdaptiveBeta: searchOptions.effectiveBeta,
    trace: { lines: [], omitted: 0 },
    label: "greedy"
  }];
  let explored = 0;
  let queued = 1;
  let bestFinal = null;
  let bestFinals = [];
  let bestFinalSignatures = new Set();
  let stoppedAtFirstHamiltonian = false;

  const sameCost = (left, right) =>
    Number.isFinite(left.totalTourCost) &&
    Number.isFinite(right.totalTourCost) &&
    Math.abs(left.totalTourCost - right.totalTourCost) <= 1e-9;
  const isBetterFinal = (candidate, currentBest) => {
    if (!currentBest) return true;
    if (candidate.hamiltonianFound && !currentBest.hamiltonianFound) return true;
    if (candidate.hamiltonianFound !== currentBest.hamiltonianFound) return false;
    if (!Number.isFinite(candidate.totalTourCost)) return false;
    if (!Number.isFinite(currentBest.totalTourCost)) return true;
    return candidate.totalTourCost < currentBest.totalTourCost - 1e-9;
  };
  const isSameBestFinal = (candidate, currentBest) =>
    currentBest &&
    candidate.hamiltonianFound === currentBest.hamiltonianFound &&
    sameCost(candidate, currentBest);
  const rememberBestFinal = candidate => {
    const signature = candidateTourSignature(candidate);
    if (bestFinalSignatures.has(signature)) return;
    bestFinalSignatures.add(signature);
    bestFinals.push(candidate);
  };

  while (queue.length > 0 && explored < maxTries) {
    queue.sort((a, b) => a.penalty - b.penalty);
    const branch = queue.shift();
    explored += 1;
    let guard = 0;
    let stoppedBecause = "completed";

    while (remainingChoices(n, branch.state) > 0) {
      const betaInfo = resolveStepBeta(n, edge, edgeSquared, branch.endpointLink, branch.state, searchOptions, branch.lastAdaptiveBeta);
      branch.lastAdaptiveBeta = betaInfo.lastAdaptiveBeta;
      if (includeTrace && searchOptions.adaptiveBeta && branch.trace.lines.length < 80) {
        appendTraceLine(branch.trace, `current standard deviation = ${formatNumber(betaInfo.standardDeviation)} adaptive beta = ${formatNumber(betaInfo.beta)}`);
      }

      const scoringOptions = betaInfo.currentStats
        ? { ...searchOptions, currentStats: betaInfo.currentStats }
        : searchOptions;
      const ranked = rankScoringEdges(n, edge, edgeSquared, branch.endpointLink, branch.state, betaInfo.beta, null, scoringOptions);
      if (ranked.length === 0) {
        stoppedBecause = "no scored candidate edges";
        break;
      }

      const best = ranked[0];
      const hasBacktrackRoom = explored + queue.length < maxTries;
      const alternativeBranches = hasBacktrackRoom
        ? buildBacktrackBranches(ranked, alternativesPerSplit, branch, edge, n, searchOptions)
        : [];
      for (const alternativeBranch of alternativeBranches) {
        const alternativeInfo = alternativeBranch.alternativeInfo;
        const alternative = alternativeBranch.alternative;
        const altEndpointLink = alternativeBranch.endpointLink;
        const altState = alternativeBranch.state;
        const regret = alternativeInfo.regret;
        const altTrace = includeTrace
          ? { lines: branch.trace.lines.slice(), omitted: branch.trace.omitted }
          : { lines: [], omitted: 0 };
        if (includeTrace) {
          const consequenceText = alternativeBranch.vcConsequenceSignature
            ? ` VC ${alternativeBranch.vcConsequenceSignature}`
            : "";
          appendTraceLine(altTrace, `backtrack choice: Edge[${alternative.from}][${alternative.to}] ${formatCandidateChoice(alternative)} regret ${formatNumber(regret)}${consequenceText}`);
        }
        queue.push({
          endpointLink: altEndpointLink,
          state: altState,
          penalty: branch.penalty + regret + (alternativeInfo.optionIndex * 1e-9),
          lastAdaptiveBeta: betaInfo.lastAdaptiveBeta,
          trace: altTrace,
          label: `regret ${formatNumber(branch.penalty + regret)}`
        });
        queued += 1;
        if (explored + queue.length > maxTries) {
          queue.sort((a, b) => a.penalty - b.penalty);
          queue.pop();
        }
      }

      if (includeTrace) {
        appendTraceLine(branch.trace, `chosen edge: Edge[${best.from}][${best.to}] ${formatCandidateChoice(best)} omega ${formatNumber(best.omega)} log-omega ${formatNumber(best.logOmega)}`);
      }
      if (!applyChosenEdge(best.from, best.to, edge, branch.endpointLink, branch.state)) {
        stoppedBecause = "chosen edge became invalid";
        break;
      }
      if (searchOptions.forceDegreeTwo || searchOptions.vertexCoverPropagation) {
        const forcedAfterChoice = propagateConfiguredForcedEdges(edge, n, branch.endpointLink, branch.state, searchOptions);
        if (includeTrace && forcedAfterChoice.forcedEdgeCount > 0) {
          appendTraceLine(branch.trace, `Forced propagation added ${forcedAfterChoice.forcedEdgeCount} edges.`);
        }
        if (branch.state.invalid) {
          stoppedBecause = branch.state.invalidReason || "forced propagation contradiction";
          break;
        }
      }
      guard++;
      if (guard > n + 2) {
        stoppedBecause = "branch guard stopped the path";
        break;
      }
    }

    const finished = finishTourFromState(edge, n, branch.endpointLink, branch.state, searchOptions);
    const candidate = {
      ...finished,
      trace: branch.trace,
      penalty: branch.penalty,
      stoppedBecause,
      exploredIndex: explored
    };
    if (isBetterFinal(candidate, bestFinal)) {
      bestFinal = candidate;
      bestFinals = [];
      bestFinalSignatures = new Set();
      rememberBestFinal(candidate);
    } else if (isSameBestFinal(candidate, bestFinal)) {
      rememberBestFinal(candidate);
    }
    if (candidate.hamiltonianFound && searchOptions.stopAtFirstHamiltonian) {
      stoppedAtFirstHamiltonian = true;
      break;
    }
  }

  const lines = includeTrace ? [] : null;
  append(lines, "Score-guided backtracking:");
  append(lines, `HC tour search mode = ${searchOptions.stopAtFirstHamiltonian ? "stop at first HC tour" : "search all tries"}`);
  append(lines, `backtrack try limit = ${maxTries}`);
  append(lines, `requested backtrack tries = ${requestedTries}`);
  append(lines, `polynomial branch cap = ${polynomialBranchCap}`);
  append(lines, `branches explored = ${explored}`);
  append(lines, `branches queued = ${queued}`);
  append(lines, `smart alternatives per split cap = ${alternativesPerSplit}`);
  append(lines, `smart backtrack log tolerance = ${formatNumber(searchOptions.smartBacktrackLogTolerance ?? 1e-9)}`);
  if (stoppedAtFirstHamiltonian) append(lines, "stopped after first HC tour = yes");
  append(lines, `best branch penalty = ${formatNumber(bestFinal ? bestFinal.penalty : 0)}`);
  append(lines, `best branch stopped because = ${bestFinal ? bestFinal.stoppedBecause : "none"}`);
  if (bestFinal && Number.isFinite(bestFinal.totalTourCost)) {
    append(lines, `minimum tour cost found = ${formatNumber(bestFinal.totalTourCost)}`);
    append(lines, `distinct minimum tours found within try limit = ${bestFinals.length}`);
    if (bestFinals.length > 1) {
      append(lines, "Minimum tour witnesses:");
      bestFinals.forEach((candidate, index) => append(lines, formatMinimumTourWitness(candidate, index + 1)));
    }
  }
  if (includeTrace && bestFinal) {
    append(lines, "Best branch trace:");
    bestFinal.trace.lines.forEach(line => append(lines, line));
    if (bestFinal.trace.omitted > 0) append(lines, `... ${bestFinal.trace.omitted} trace lines omitted ...`);
    append(lines, bestFinal.lines.join("\n"));
    return {
      lines,
      totalTourCost: bestFinal.totalTourCost,
      partialTourCost: bestFinal.totalTourCost,
      hamiltonianFound: bestFinal.hamiltonianFound,
      chosenEdges: bestFinal.chosenEdges,
      tourOrder: bestFinal.tourOrder,
      bestFinals,
      stoppedAtFirstHamiltonian
    };
  }
  if (!bestFinal) append(lines, "No branch was completed.");
  return bestFinal
    ? {
      lines: lines || [],
      totalTourCost: bestFinal.totalTourCost,
      partialTourCost: bestFinal.totalTourCost,
      hamiltonianFound: bestFinal.hamiltonianFound,
      chosenEdges: bestFinal.chosenEdges,
      tourOrder: bestFinal.tourOrder,
      bestFinals,
      stoppedAtFirstHamiltonian
    }
    : { lines: lines || [], totalTourCost: NaN, partialTourCost: NaN, hamiltonianFound: false, bestFinals: [] };
}

function applyDegreeTwoForcedEdges(edge, n, endpointLink, state) {
  const tried = new Set();
  let forcedVertexCount = 0;
  let forcedEdgeCount = 0;

  for (let vertex = 1; vertex <= n; vertex++) {
    const neighbors = [];
    for (let neighbor = 1; neighbor <= n; neighbor++) {
      if (vertex !== neighbor && edge[vertex][neighbor] !== 0) neighbors.push(neighbor);
    }
    if (neighbors.length !== 2) continue;

    let appliedForVertex = false;
    for (const neighbor of neighbors) {
      const key = edgeKey(vertex, neighbor);
      if (tried.has(key)) continue;
      tried.add(key);
      if (applyChosenEdge(vertex, neighbor, edge, endpointLink, state)) {
        forcedEdgeCount += 1;
        appliedForVertex = true;
      }
    }
    if (appliedForVertex) forcedVertexCount += 1;
  }

  return {
    forcedVertexCount,
    forcedEdgeCount,
    forcedEdgeTotal: state.chosenEdgeTotal
  };
}

function propagateDegreeTwoForcedEdges(edge, n, endpointLink, state) {
  const total = {
    forcedVertexCount: 0,
    forcedEdgeCount: 0,
    forcedEdgeTotal: state.chosenEdgeTotal,
    passes: 0
  };
  while (true) {
    const beforeUsed = state.usedVertices;
    const beforeTotal = state.chosenEdgeTotal;
    const forced = applyDegreeTwoForcedEdges(edge, n, endpointLink, state);
    total.passes += 1;
    total.forcedVertexCount += forced.forcedVertexCount;
    total.forcedEdgeCount += forced.forcedEdgeCount;
    total.forcedEdgeTotal = state.chosenEdgeTotal;
    if (state.usedVertices === beforeUsed && state.chosenEdgeTotal === beforeTotal) break;
    if (total.passes > n + 2) throw new Error("Degree-2 forced-edge propagation exceeded the safety guard.");
  }
  return total;
}

function ensureVertexCoverPropagationState(state) {
  if (!state.vcSelectedVertices) state.vcSelectedVertices = new Set();
  if (!state.vcRejectedVertices) state.vcRejectedVertices = new Set();
}

function forceVertexCoverSelected(vertex, meta, edge, endpointLink, state, chosenKeys) {
  ensureVertexCoverPropagationState(state);
  const result = { selectedVertexCount: 0, forcedEdgeCount: 0 };
  if (state.vcRejectedVertices.has(vertex)) {
    state.invalid = true;
    state.invalidReason = `Vertex Cover contradiction: vertex ${vertex} was both chosen and not chosen.`;
    return result;
  }
  if (!state.vcSelectedVertices.has(vertex)) {
    state.vcSelectedVertices.add(vertex);
    result.selectedVertexCount += 1;
    if (state.vcSelectedVertices.size > meta.coverLimit) {
      state.invalid = true;
      state.invalidReason = `Vertex Cover propagation selected more than k=${meta.coverLimit} vertices.`;
      return result;
    }
  }

  const connectors = meta.connectorEdgesByVertex[vertex] || [];
  for (const connector of connectors) {
    const key = edgeKey(connector.from, connector.to);
    if (chosenKeys.has(key)) continue;
    if (!applyChosenEdge(connector.from, connector.to, edge, endpointLink, state)) {
      state.invalid = true;
      state.invalidReason = `Vertex Cover propagation could not force connector Edge[${connector.from}][${connector.to}] for vertex ${vertex}.`;
      return result;
    }
    chosenKeys.add(key);
    result.forcedEdgeCount += 1;
  }
  return result;
}

function forceVertexCoverRejected(vertex, meta, edge, endpointLink, state, chosenKeys) {
  ensureVertexCoverPropagationState(state);
  const result = { rejectedVertexCount: 0, selectedVertexCount: 0, forcedEdgeCount: 0 };
  if (state.vcSelectedVertices.has(vertex)) {
    state.invalid = true;
    state.invalidReason = `Vertex Cover contradiction: vertex ${vertex} was both chosen and not chosen.`;
    return result;
  }
  if (!state.vcRejectedVertices.has(vertex)) {
    state.vcRejectedVertices.add(vertex);
    result.rejectedVertexCount += 1;
  }

  const neighbors = meta.neighborsByVertex[vertex] || [];
  for (const neighbor of neighbors) {
    const selected = forceVertexCoverSelected(neighbor, meta, edge, endpointLink, state, chosenKeys);
    result.selectedVertexCount += selected.selectedVertexCount;
    result.forcedEdgeCount += selected.forcedEdgeCount;
    if (state.invalid) return result;
  }
  return result;
}

function forceVertexCoverPatternPath(pattern, edge, endpointLink, state, chosenKeys) {
  const result = { forcedEdgeCount: 0 };
  for (const pathEdge of pattern.pathEdges) {
    if (chosenKeys.has(pathEdge.key)) continue;
    if (!applyChosenEdge(pathEdge.from, pathEdge.to, edge, endpointLink, state)) {
      state.invalid = true;
      state.invalidReason = `Vertex Cover propagation could not force gadget path Edge[${pathEdge.from}][${pathEdge.to}].`;
      return result;
    }
    chosenKeys.add(pathEdge.key);
    result.forcedEdgeCount += 1;
  }
  return result;
}

function applyVertexCoverGadgetPropagation(edge, n, endpointLink, state, meta) {
  const total = {
    selectedVertexCount: 0,
    rejectedVertexCount: 0,
    forcedEdgeCount: 0
  };
  if (!meta) return total;
  ensureVertexCoverPropagationState(state);
  const chosenKeys = chosenEdgeKeySet(state);

  for (const pattern of meta.rejectionPatterns) {
    if (!pattern.crossKeys.some(key => chosenKeys.has(key))) continue;
    const forcedPath = forceVertexCoverPatternPath(pattern, edge, endpointLink, state, chosenKeys);
    total.forcedEdgeCount += forcedPath.forcedEdgeCount;
    if (state.invalid) return total;

    const rejected = forceVertexCoverRejected(pattern.rejectedVertex, meta, edge, endpointLink, state, chosenKeys);
    total.rejectedVertexCount += rejected.rejectedVertexCount;
    total.selectedVertexCount += rejected.selectedVertexCount;
    total.forcedEdgeCount += rejected.forcedEdgeCount;
    if (state.invalid) return total;

    const selected = forceVertexCoverSelected(pattern.coveringVertex, meta, edge, endpointLink, state, chosenKeys);
    total.selectedVertexCount += selected.selectedVertexCount;
    total.forcedEdgeCount += selected.forcedEdgeCount;
    if (state.invalid) return total;
  }

  return total;
}

function propagateConfiguredForcedEdges(edge, n, endpointLink, state, options = {}) {
  const total = {
    degreeTwoVertexCount: 0,
    degreeTwoForcedEdgeCount: 0,
    vcSelectedVertexCount: 0,
    vcRejectedVertexCount: 0,
    vcForcedEdgeCount: 0,
    forcedEdgeCount: 0,
    forcedEdgeTotal: state.chosenEdgeTotal,
    passes: 0
  };

  while (!state.invalid) {
    const beforeChosen = state.chosenEdges ? state.chosenEdges.length : 0;
    const beforeSelected = state.vcSelectedVertices ? state.vcSelectedVertices.size : 0;
    const beforeRejected = state.vcRejectedVertices ? state.vcRejectedVertices.size : 0;

    if (options.forceDegreeTwo) {
      const forced = propagateDegreeTwoForcedEdges(edge, n, endpointLink, state);
      total.degreeTwoVertexCount += forced.forcedVertexCount;
      total.degreeTwoForcedEdgeCount += forced.forcedEdgeCount;
    }

    if (options.vertexCoverPropagation) {
      const vc = applyVertexCoverGadgetPropagation(edge, n, endpointLink, state, options.vertexCoverPropagation);
      total.vcSelectedVertexCount += vc.selectedVertexCount;
      total.vcRejectedVertexCount += vc.rejectedVertexCount;
      total.vcForcedEdgeCount += vc.forcedEdgeCount;
    }

    total.passes += 1;
    total.forcedEdgeTotal = state.chosenEdgeTotal;
    const afterChosen = state.chosenEdges ? state.chosenEdges.length : 0;
    const afterSelected = state.vcSelectedVertices ? state.vcSelectedVertices.size : 0;
    const afterRejected = state.vcRejectedVertices ? state.vcRejectedVertices.size : 0;
    if (afterChosen === beforeChosen && afterSelected === beforeSelected && afterRejected === beforeRejected) break;
    if (total.passes > n + 2) {
      state.invalid = true;
      state.invalidReason = "Forced-edge propagation exceeded the safety guard.";
      break;
    }
  }

  total.forcedEdgeCount = total.degreeTwoForcedEdgeCount + total.vcForcedEdgeCount;
  return total;
}

function solveTrackingSolver(edge, n, beta, sourceLabel, options = {}) {
  if (n < 2) throw new Error("Need at least 2 vertices.");
  const lines = options.compactOutput ? null : [];
  if (!options.allowedEdges && options.allowedEdgeKeys) {
    options.allowedEdges = Array.from(options.allowedEdgeKeys).map(key => {
      const [from, to] = key.split(":").map(Number);
      const weight = edge[from][to];
      return { from, to, weight, weightSquared: weight * weight, key };
    });
    attachEdgeListAdjacency(options.allowedEdges, n);
  }
  if (options.allowedEdges) attachEdgeListAdjacency(options.allowedEdges, n);
  const momentEdgeList = options.momentEdgeList || options.allowedEdges || buildNonzeroEdgeList(edge, n);
  const candidateEdgeList = options.candidateEdgeList || options.allowedEdges || (options.scoreZeroEdges ? null : momentEdgeList);
  if (momentEdgeList) attachEdgeListAdjacency(momentEdgeList, n);
  if (candidateEdgeList) attachEdgeListAdjacency(candidateEdgeList, n);
  options.momentEdgeList = momentEdgeList;
  options.candidateEdgeList = candidateEdgeList;
  const edgeSquared = null;
  if (options.hcNecessaryPrecheck) {
    const necessary = hamiltonianNecessaryGraphCheck(edge, n);
    if (!necessary.ok) {
      append(lines, `HC necessary precheck failed: ${necessary.reason}.`);
      return {
        text: lines ? lines.join("\n") : "",
        totalTourCost: NaN,
        partialTourCost: NaN,
        hamiltonianFound: false,
        chosenEdges: [],
        tourOrder: null,
        bestFinals: [],
        precheckReason: necessary.reason,
        moments: null
      };
    }
    append(lines, "HC necessary precheck passed.");
  }
  const moments = computeTheoryMomentsFromEdgeList(momentEdgeList, n);
  const suggestedBeta = 1.0 / Math.sqrt(Math.max(Number.MIN_VALUE, moments.tourVariance));
  const effectiveBeta = Number.isFinite(beta) ? beta : suggestedBeta;
  const adaptiveBeta = options.adaptiveBeta !== false;
  const betaMultiplier = Number.isFinite(options.betaMultiplier) ? options.betaMultiplier : 1;
  const scoreMethod = "importance";
  append(lines, `Source: ${sourceLabel}`);
  append(lines, `n = ${n}`);
  append(lines, `the average  = ${formatNumber(moments.meanTourLength)}`);
  append(lines, `S_self ${formatNumber(moments.selfInteractionSum)} S_neighbor ${formatNumber(moments.neighborInteractionSum)} S_non_neighbor ${formatNumber(moments.disjointInteractionSum)}`);
  append(lines, `the standard deviation = ${formatNumber(moments.tourVariance)} ${formatNumber(Math.sqrt(Math.max(0, moments.tourVariance)))}`);
  append(lines, `suggested beta value = ${formatNumber(suggestedBeta)}`);
  append(lines, `adaptive beta = ${adaptiveBeta ? "on (automatic)" : "off"}`);
  append(lines, "score method = importance lnZ(force edge) - lnZ(forbid edge) (automatic)");
  const entropy = lnGamma(n) - Math.log(2.0);
  const partition = entropy - (effectiveBeta * moments.meanTourLength) + ((effectiveBeta * effectiveBeta) * 0.5 * moments.tourVariance);
  append(lines, `entropy ${formatNumber(entropy)} partition ${formatNumber(partition)}`);

  const endpointLink = Array(n + 1).fill(0);
  const state = { closedChains: 0, usedVertices: 0, chosenEdgeTotal: 0, chosenEdges: [] };
  if (options.allowedEdgeKeys) state.allowedEdgeKeys = options.allowedEdgeKeys;
  if (options.allowedEdges) state.allowedEdges = options.allowedEdges;
  state.scoreZeroEdges = Boolean(options.scoreZeroEdges);
  let propagationAfterChoiceCount = 0;
  let propagationAfterChoiceEdges = 0;
  if (options.forceDegreeTwo || options.vertexCoverPropagation) {
    const forced = propagateConfiguredForcedEdges(edge, n, endpointLink, state, options);
    append(lines, "Degree-2 forced-edge precheck:");
    append(lines, `vertices with exactly two edges applied = ${forced.degreeTwoVertexCount}`);
    append(lines, `forced edges applied = ${forced.degreeTwoForcedEdgeCount}`);
    append(lines, `forced propagation passes = ${forced.passes}`);
    append(lines, `forced edge total = ${formatNumber(forced.forcedEdgeTotal)}`);
    if (options.vertexCoverPropagation) {
      append(lines, "Vertex Cover gadget consequence propagation:");
      append(lines, `VC vertices forced chosen = ${forced.vcSelectedVertexCount}`);
      append(lines, `VC vertices forced not chosen = ${forced.vcRejectedVertexCount}`);
      append(lines, `VC connector edges forced = ${forced.vcForcedEdgeCount}`);
    }
  }
  const backtrackLimit = Math.max(0, Math.floor(Number(options.backtrackLimit || 0)));
  if (backtrackLimit > 0) {
    const search = runScoreGuidedBacktracking(edge, n, edgeSquared, endpointLink, state, {
      ...options,
      effectiveBeta,
      adaptiveBeta,
      betaMultiplier,
      backtrackLimit,
      alternativesPerSplit: 2,
      smartBacktrackLogTolerance: 1e-9
    });
    search.lines.forEach(line => append(lines, line));
    if (Number.isFinite(search.totalTourCost)) {
      append(lines, `Total tour cost = ${formatNumber(search.totalTourCost)}`);
    } else {
      append(lines, "Total tour cost = no completed tour");
      if (Number.isFinite(search.partialTourCost)) {
        append(lines, `Best partial tour cost = ${formatNumber(search.partialTourCost)}`);
      }
    }
    return {
      text: lines ? lines.join("\n") : "",
      totalTourCost: search.totalTourCost,
      partialTourCost: search.partialTourCost,
      hamiltonianFound: search.hamiltonianFound,
      chosenEdges: search.chosenEdges,
      tourOrder: search.tourOrder,
      bestFinals: search.bestFinals || [],
      stoppedAtFirstHamiltonian: search.stoppedAtFirstHamiltonian,
      moments
    };
  }
  let totalTourCost = state.chosenEdgeTotal;
  let guard = 0;
  let lastAdaptiveBeta = effectiveBeta;
  while (!state.invalid && n - state.usedVertices + state.closedChains - 1 > 0) {
    let stepBeta = effectiveBeta;
    let currentStats = null;
    if (adaptiveBeta) {
      const current = adaptiveBetaForState(n, edge, edgeSquared, endpointLink, state, betaMultiplier, options.momentEdgeList);
      if (current.beta !== null && Number.isFinite(current.beta)) lastAdaptiveBeta = current.beta;
      stepBeta = lastAdaptiveBeta;
      currentStats = current.stats;
      append(lines, `current standard deviation = ${formatNumber(current.stats.standardDeviation)} adaptive beta = ${formatNumber(stepBeta)}`);
    }
    const scoringOptions = currentStats ? { ...options, currentStats } : options;
    const best = findBestScoringEdge(n, edge, edgeSquared, endpointLink, state, stepBeta, null, scoringOptions);
    if (!best.from) break;
    append(lines, `The biggest probability is ${formatNumber(best.probability)} at Edge[${best.from}][${best.to}].`);
    if (best.scoreMethod === "importance") {
      append(lines, `Importance score = ${formatNumber(best.importance)} from plus lnZ ${formatNumber(best.plusLogZ)} minus lnZ ${formatNumber(best.minusLogZ)}; normalized by omega = ${formatNumber(best.omega)} and log-omega = ${formatNumber(best.logOmega)}.`);
    } else {
      append(lines, `Taylor log-score = ${formatNumber(best.logScore)} normalized by omega = ${formatNumber(best.omega)} and log-omega = ${formatNumber(best.logOmega)}.`);
    }
    if (best.className) append(lines, `Edge class = ${best.className}.`);
    if (!applyChosenEdge(best.from, best.to, edge, endpointLink, state)) break;
    if (options.forceDegreeTwo || options.vertexCoverPropagation) {
      const forcedAfterChoice = propagateConfiguredForcedEdges(edge, n, endpointLink, state, options);
      if (forcedAfterChoice.forcedEdgeCount > 0) {
        propagationAfterChoiceCount += 1;
        propagationAfterChoiceEdges += forcedAfterChoice.forcedEdgeCount;
        append(lines, `Forced propagation after choice added ${forcedAfterChoice.forcedEdgeCount} edges in ${forcedAfterChoice.passes} passes.`);
        if (options.vertexCoverPropagation &&
            (forcedAfterChoice.vcSelectedVertexCount > 0 || forcedAfterChoice.vcRejectedVertexCount > 0)) {
          append(lines, `VC consequence: chosen vertices +${forcedAfterChoice.vcSelectedVertexCount}, not-chosen vertices +${forcedAfterChoice.vcRejectedVertexCount}, connector edges +${forcedAfterChoice.vcForcedEdgeCount}.`);
        }
      }
    }
    guard++;
    if (guard > n + 2) throw new Error("Solver guard stopped a loop that exceeded n steps.");
  }
  const finished = finishTourFromState(edge, n, endpointLink, state, options);
  finished.lines.forEach(line => append(lines, line));
  totalTourCost = finished.totalTourCost;
  const hamiltonianFound = finished.hamiltonianFound;
  if (options.forceDegreeTwo) {
    append(lines, `post-choice forced propagation events = ${propagationAfterChoiceCount}`);
    append(lines, `post-choice forced edges = ${propagationAfterChoiceEdges}`);
  }
  append(lines, `Total tour cost = ${formatNumber(totalTourCost)}`);
  return {
    text: lines ? lines.join("\n") : "",
    totalTourCost,
    hamiltonianFound,
    chosenEdges: finished.chosenEdges,
    tourOrder: finished.tourOrder,
    bestFinals: [finished],
    moments
  };
}

function runTrackingSolver(edge, n, beta, sourceLabel, options = {}) {
  const result = solveTrackingSolver(edge, n, beta, sourceLabel, { ...options, compactOutput: true });
  const isTspStyle = options.tourKind === "tsp";
  const lines = [];
  append(lines, "Final answer:");
  append(lines, isTspStyle
    ? "Best tour result: TOUR FOUND"
    : (result.hamiltonianFound ? "HC decision: HAMILTONIAN CYCLE FOUND" : "HC decision: HAMILTONIAN CYCLE NOT FOUND"));
  append(lines, `HC nodes = ${n}`);
  append(lines, `HC backtrack tries = ${Math.max(0, Math.floor(Number(options.backtrackLimit || 0)))}`);
  if (options.stopAtFirstHamiltonian) append(lines, "HC tour search mode = stop at first HC tour");
  if (result.precheckReason) append(lines, `HC necessary precheck failed = ${result.precheckReason}`);
  if (Number.isFinite(result.totalTourCost)) append(lines, `${isTspStyle ? "best tour cost" : "HC tour cost"} = ${formatNumber(result.totalTourCost)}`);
  if (Number.isFinite(result.partialTourCost) && !Number.isFinite(result.totalTourCost)) append(lines, `${isTspStyle ? "best partial tour cost" : "HC best partial tour cost"} = ${formatNumber(result.partialTourCost)}`);
  appendTrackingTourWitnesses(lines, result, options.tourKind || "hc");
  return lines.join("\n");
}

function getHcSolveNodeLimit() {
  const input = document.getElementById("hcSolveNodeLimit");
  if (!input) return Infinity;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("HC solve node limit must be a nonnegative number.");
  return Math.floor(value);
}

function getHcBetaMultiplier() {
  return 1;
}

function getHcScoreMethod() {
  return "importance";
}

function getHcAdaptiveBeta() {
  return true;
}

function getTspRepairPasses(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return 0;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("TSP repair passes must be a nonnegative number.");
  return Math.floor(value);
}

function getHcBacktrackTries() {
  const input = document.getElementById("hcBacktrackTries");
  if (!input) return 25;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("HC backtrack tries must be a nonnegative number.");
  return Math.floor(value);
}

function getHcTourSearchMode() {
  const checkbox = document.getElementById("hcSearchAllAnswers");
  if (checkbox) return checkbox.checked ? "all" : "first";
  const input = document.getElementById("hcTourSearchMode");
  return input && input.value === "first" ? "first" : "all";
}

function shouldStopAtFirstHcTour() {
  return getHcTourSearchMode() === "first";
}

function runCompressedHcDecision(graph, sourceLabel) {
  const limit = getHcSolveNodeLimit();
  const backtrackTries = getHcBacktrackTries();
  if (graph.n > limit) {
    const lines = [];
    append(lines, "NP-douce HC solver result:");
    append(lines, `HC nodes = ${graph.n}`);
    append(lines, `HC solver not run because ${graph.n} nodes is above the HC solve node limit ${limit}.`);
    append(lines, "Raise the HC solve node limit if you want to force this reduced HC instance through the solver.");
    return { text: "", summary: lines.join("\n"), totalTourCost: NaN, hamiltonianFound: false, notComputed: true };
  }
  const graphEdgeList = graph.allowedEdges || buildNonzeroEdgeList(graph.edge, graph.n);
  const preferredCandidateEdgeList = graph.vertexCoverPropagation &&
    graph.vertexCoverPropagation.witnessKind === "sat" &&
    graph.vertexCoverPropagation.satDecisionEdgeKeys
      ? graphEdgeList.filter(item => graph.vertexCoverPropagation.satDecisionEdgeKeys.has(item.key))
      : null;
  const baseMoments = computeTheoryMomentsFromEdgeList(graphEdgeList, graph.n);
  const suggestedBeta = 1.0 / Math.sqrt(Math.max(Number.MIN_VALUE, baseMoments.tourVariance));
  const beta = suggestedBeta;
  const result = solveTrackingSolver(graph.edge, graph.n, beta, sourceLabel, {
    forceDegreeTwo: true,
    allowedEdgeKeys: graph.allowedEdgeKeys || null,
    allowedEdges: graph.allowedEdges || null,
    momentEdgeList: graphEdgeList,
    candidateEdgeList: graph.allowedEdges || graphEdgeList,
    preferredCandidateEdgeList,
    vertexCoverPropagation: graph.vertexCoverPropagation || null,
    repairPasses: 0,
    backtrackLimit: backtrackTries,
    stopAtFirstHamiltonian: shouldStopAtFirstHcTour(),
    completeWithNeutralEdges: true,
    adaptiveBeta: true,
    betaMultiplier: 1,
    scoreMethod: "importance",
    compactOutput: true
  });
  const lines = [];
  append(lines, "NP-douce HC solver result:");
  append(lines, `HC nodes = ${graph.n}`);
  if (graph.allowedEdgeKeys) append(lines, `allowed HC edges scored = ${graph.allowedEdgeKeys.size}`);
  if (graph.vertexCoverPropagation) append(lines, "VC gadget propagation = on");
  append(lines, `HC tour search mode = ${shouldStopAtFirstHcTour() ? "stop at first HC tour" : "search all tries"}`);
  append(lines, "HC score method = importance (automatic)");
  append(lines, "HC adaptive beta = on (automatic)");
  append(lines, `HC backtrack tries = ${backtrackTries}`);
  append(lines, `starting HC beta value = ${formatNumber(beta)}`);
  if (Number.isFinite(result.totalTourCost)) {
    append(lines, `HC tour cost = ${formatNumber(result.totalTourCost)}`);
  } else {
    append(lines, "HC tour cost = no completed tour");
    if (Number.isFinite(result.partialTourCost)) {
      append(lines, `HC best partial tour cost = ${formatNumber(result.partialTourCost)}`);
    }
  }
  append(lines, `HC target cost = ${formatNumber(-graph.n)}`);
  append(lines, result.hamiltonianFound ? "HC decision: HAMILTONIAN CYCLE FOUND" : "HC decision: HAMILTONIAN CYCLE NOT FOUND");
  return { ...result, summary: lines.join("\n"), notComputed: false };
}

function inferredAnswerLine(hc, label, yesText = "YES", noText = "NO") {
  if (hc.notComputed) return `${label} answer inferred from HC: NOT COMPUTED`;
  return hc.hamiltonianFound
    ? `${label} answer inferred from HC: ${yesText}`
    : `${label} answer inferred from HC: NOT FOUND BY HC SEARCH`;
}

function tokenizeNumbers(text) {
  return text.trim().split(/\s+/).filter(Boolean).map(Number);
}

function parsePairs(text) {
  const nums = tokenizeNumbers(text);
  if (nums.length % 2 !== 0) throw new Error("Pairs input needs an even count of numbers.");
  let n = 0;
  for (let i = 0; i < nums.length; i += 2) n = Math.max(n, nums[i], nums[i + 1]);
  const edge = makeMatrix(n);
  for (let i = 0; i < nums.length; i += 2) {
    const u = nums[i], v = nums[i + 1];
    edge[u][v] = -1;
    edge[v][u] = -1;
  }
  return { edge, n };
}

function parseMatrix(text) {
  const nums = tokenizeNumbers(text);
  const n = nums[0];
  if (!Number.isInteger(n) || n < 2) throw new Error("Matrix input first number must be n.");
  if (nums.length < 1 + n * n) throw new Error(`Matrix input needs ${n * n} weights after n.`);
  const edge = makeMatrix(n);
  let p = 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= n; j++) edge[i][j] = nums[p++];
  }
  return { edge, n };
}

function parseManual(text) {
  const nums = tokenizeNumbers(text);
  const n = nums[0];
  if (!Number.isInteger(n) || n < 2) throw new Error("Manual input first number must be n.");
  const expected = (n * (n - 1)) / 2;
  if (nums.length < 1 + expected) throw new Error(`Manual input needs ${expected} upper-triangle weights after n.`);
  const edge = makeMatrix(n);
  let p = 1;
  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      edge[i][j] = nums[p];
      edge[j][i] = nums[p];
      p++;
    }
  }
  return { edge, n };
}

function parsePoints(text) {
  const nums = tokenizeNumbers(text);
  const n = nums[0];
  if (!Number.isInteger(n) || n < 2) throw new Error("Points input first number must be n.");
  if (nums.length < 1 + n * 2) throw new Error(`Points input needs ${n} x y coordinate pairs.`);
  const points = [];
  let p = 1;
  for (let i = 0; i < n; i++) points.push({ x: nums[p++], y: nums[p++] });
  const edge = makeMatrix(n);
  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      const dx = points[i - 1].x - points[j - 1].x;
      const dy = points[i - 1].y - points[j - 1].y;
      edge[i][j] = Math.sqrt(dx * dx + dy * dy);
      edge[j][i] = edge[i][j];
    }
  }
  return { edge, n, points };
}

function literalIsTrue(literal, assignment) {
  const variable = Math.abs(literal);
  if (assignment[variable] === -1) return false;
  const value = assignment[variable] === 1;
  return literal > 0 ? value : !value;
}

function clauseIsSatisfied(clause, assignment) {
  return clause.some(literal => literalIsTrue(literal, assignment));
}

function formulaIsSatisfied(clauses, assignment) {
  return clauses.every(clause => clauseIsSatisfied(clause, assignment));
}

function partialFormulaCanStillBeSatisfied(clauses, assignment) {
  for (const clause of clauses) {
    let satisfied = false;
    let hasUnassigned = false;
    for (const literal of clause) {
      const variable = Math.abs(literal);
      if (assignment[variable] === -1) {
        hasUnassigned = true;
      } else if (literalIsTrue(literal, assignment)) {
        satisfied = true;
      }
    }
    if (!satisfied && !hasUnassigned) return false;
  }
  return true;
}

function propagateSatUnitsIntoAssignment(clauses, assignment) {
  const forcedDecisions = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (const clause of clauses) {
      let satisfied = false;
      let openLiteral = 0;
      let openCount = 0;

      for (const literal of clause) {
        const variable = Math.abs(literal);
        if (assignment[variable] === -1 || assignment[variable] === undefined) {
          openLiteral = literal;
          openCount += 1;
        } else if (literalIsTrue(literal, assignment)) {
          satisfied = true;
          break;
        }
      }

      if (satisfied) continue;
      if (openCount === 0) {
        return {
          valid: false,
          forcedDecisions,
          reason: "partial assignment already falsifies a clause"
        };
      }

      if (openCount === 1) {
        const variable = Math.abs(openLiteral);
        const value = openLiteral > 0 ? 1 : 0;
        if (assignment[variable] !== -1 && assignment[variable] !== undefined && assignment[variable] !== value) {
          return {
            valid: false,
            forcedDecisions,
            reason: `unit clauses force both values for x${variable}`
          };
        }
        if (assignment[variable] === -1 || assignment[variable] === undefined) {
          assignment[variable] = value;
          forcedDecisions.push({ variable, value });
          changed = true;
        }
      }
    }
  }

  return { valid: true, forcedDecisions, reason: "" };
}

function satUnitForcedDecisionsFromAssignment(clauses, assignment) {
  const working = assignment.slice();
  const propagated = propagateSatUnitsIntoAssignment(clauses, working);
  if (!propagated.valid) return propagated;

  const forcedDecisions = [];
  for (let variable = 1; variable < working.length; variable++) {
    if (assignment[variable] === -1 && working[variable] !== -1 && working[variable] !== undefined) {
      forcedDecisions.push({ variable, value: working[variable] });
    }
  }

  return { valid: true, forcedDecisions, reason: "" };
}

function satDecisionFormulaPrecheck(candidate, assignment, clauses, partialAssignmentValidator, branch) {
  const working = assignment.slice();
  if (working[candidate.variable] !== -1 && working[candidate.variable] !== candidate.value) return false;
  working[candidate.variable] = candidate.value;
  const propagated = propagateSatUnitsIntoAssignment(clauses, working);
  if (!propagated.valid) return false;
  if (partialAssignmentValidator && !partialAssignmentValidator(working, branch)) return false;
  return true;
}

function findSatisfyingAssignment(variableCount, clauses, assignment) {
  if (!partialFormulaCanStillBeSatisfied(clauses, assignment)) return false;
  let variable = 0;
  for (let i = 1; i <= variableCount; i++) {
    if (assignment[i] === -1) {
      variable = i;
      break;
    }
  }
  if (variable === 0) return formulaIsSatisfied(clauses, assignment);
  assignment[variable] = 1;
  if (findSatisfyingAssignment(variableCount, clauses, assignment)) return true;
  assignment[variable] = 0;
  if (findSatisfyingAssignment(variableCount, clauses, assignment)) return true;
  assignment[variable] = -1;
  return false;
}

function parse3Sat(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  if (!lines.length) throw new Error("3-SAT input is empty.");
  const first = lines[0].split(/\s+/).map(Number);
  const variableCount = first[0], clauseCount = first[1], padding = first[2] || 0;
  if (!Number.isInteger(variableCount) || variableCount <= 0) throw new Error("First line needs a positive variable count.");
  if (!Number.isInteger(clauseCount) || clauseCount <= 0) throw new Error("First line needs a positive clause count.");
  if (padding < 0) throw new Error("Padding cannot be negative.");
  const clauses = [];
  for (let i = 0; i < clauseCount; i++) {
    const parts = (lines[i + 1] || "").split(/\s+/).filter(Boolean).map(Number);
    if (parts.length !== 3) throw new Error(`Clause ${i + 1} must have exactly 3 literals.`);
    for (const literal of parts) {
      if (literal === 0 || Math.abs(literal) > variableCount) throw new Error(`Invalid literal ${literal}.`);
    }
    clauses.push(parts);
  }
  return { variableCount, clauseCount, padding, clauses };
}

function parseVertexCover(text) {
  const nums = tokenizeNumbers(text);
  if (nums.length < 2) throw new Error("Vertex cover input first line needs: vertices k optional_padding.");
  const n = nums[0];
  const k = nums[1];
  const padding = nums.length % 2 === 1 ? nums[2] : 0;
  const edgeStart = nums.length % 2 === 1 ? 3 : 2;
  if (!Number.isInteger(n) || n <= 0) throw new Error("Vertex count must be a positive integer.");
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be a nonnegative integer.");
  if (!Number.isInteger(padding) || padding < 0) throw new Error("Optional padding must be a nonnegative integer.");
  if ((nums.length - edgeStart) % 2 !== 0) throw new Error("Vertex cover edges must be pairs of vertices.");

  const edges = [];
  for (let i = edgeStart; i < nums.length; i += 2) {
    const u = nums[i], v = nums[i + 1];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) {
      throw new Error(`Invalid edge ${u} ${v}.`);
    }
    edges.push([u, v]);
  }
  return { n, k, padding, edges };
}

function parseClique(text) {
  const nums = tokenizeNumbers(text);
  if (nums.length < 2) throw new Error("Clique input first line needs: vertices k optional_padding.");
  const n = nums[0];
  const k = nums[1];
  const padding = nums.length % 2 === 1 ? nums[2] : 0;
  const edgeStart = nums.length % 2 === 1 ? 3 : 2;
  if (!Number.isInteger(n) || n <= 0) throw new Error("Vertex count must be a positive integer.");
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be a nonnegative integer.");
  if (!Number.isInteger(padding) || padding < 0) throw new Error("Optional padding must be a nonnegative integer.");
  if ((nums.length - edgeStart) % 2 !== 0) throw new Error("Clique edges must be pairs of vertices.");

  const seen = new Set();
  const edges = [];
  for (let i = edgeStart; i < nums.length; i += 2) {
    let u = nums[i], v = nums[i + 1];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) {
      throw new Error(`Invalid edge ${u} ${v}.`);
    }
    if (u > v) [u, v] = [v, u];
    const key = `${u}:${v}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([u, v]);
  }
  return { n, k, padding, edges };
}

function parseIndependentSet(text) {
  const nums = tokenizeNumbers(text);
  if (nums.length < 2) throw new Error("Independent set input first line needs: vertices k optional_padding.");
  const n = nums[0];
  const k = nums[1];
  const padding = nums.length % 2 === 1 ? nums[2] : 0;
  const edgeStart = nums.length % 2 === 1 ? 3 : 2;
  if (!Number.isInteger(n) || n <= 0) throw new Error("Vertex count must be a positive integer.");
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be a nonnegative integer.");
  if (!Number.isInteger(padding) || padding < 0) throw new Error("Optional padding must be a nonnegative integer.");
  if ((nums.length - edgeStart) % 2 !== 0) throw new Error("Independent set edges must be pairs of vertices.");

  const seen = new Set();
  const edges = [];
  for (let i = edgeStart; i < nums.length; i += 2) {
    let u = nums[i], v = nums[i + 1];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) {
      throw new Error(`Invalid edge ${u} ${v}.`);
    }
    if (u > v) [u, v] = [v, u];
    const key = `${u}:${v}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([u, v]);
  }
  return { n, k, padding, edges };
}

function parseSetCover(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  if (!lines.length) throw new Error("Set cover input is empty.");
  const first = lines[0].split(/\s+/).map(Number);
  if (first.length < 3 || first.length > 4) {
    throw new Error("Set cover first line needs: universe_size set_count k optional_padding.");
  }
  const universeSize = first[0];
  const setCount = first[1];
  const k = first[2];
  const padding = first[3] || 0;
  if (!Number.isInteger(universeSize) || universeSize <= 0) throw new Error("Universe size must be a positive integer.");
  if (!Number.isInteger(setCount) || setCount <= 0) throw new Error("Set count must be a positive integer.");
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be a nonnegative integer.");
  if (!Number.isInteger(padding) || padding < 0) throw new Error("Optional padding must be a nonnegative integer.");
  if (lines.length - 1 < setCount) throw new Error(`Expected ${setCount} set lines.`);

  const sets = [];
  for (let setIndex = 0; setIndex < setCount; setIndex++) {
    const values = lines[setIndex + 1].split(/\s+/).filter(Boolean).map(Number);
    if (!values.length) throw new Error(`Set ${setIndex + 1} must contain at least one element.`);
    const seen = new Set();
    const elements = [];
    for (const element of values) {
      if (!Number.isInteger(element) || element < 1 || element > universeSize) {
        throw new Error(`Invalid element ${element} in set ${setIndex + 1}.`);
      }
      if (seen.has(element)) continue;
      seen.add(element);
      elements.push(element);
    }
    sets.push(elements);
  }
  return { universeSize, setCount, k, padding, sets };
}

function parseX3c(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  if (!lines.length) throw new Error("X3C input is empty.");
  const first = lines[0].split(/\s+/).map(Number);
  if (first.length < 2 || first.length > 3) {
    throw new Error("X3C first line needs: universe_size set_count optional_padding.");
  }
  const universeSize = first[0];
  const setCount = first[1];
  const padding = first[2] || 0;
  if (!Number.isInteger(universeSize) || universeSize <= 0) throw new Error("Universe size must be a positive integer.");
  if (!Number.isInteger(setCount) || setCount <= 0) throw new Error("Set count must be a positive integer.");
  if (!Number.isInteger(padding) || padding < 0) throw new Error("Optional padding must be a nonnegative integer.");
  if (lines.length - 1 < setCount) throw new Error(`Expected ${setCount} 3-set lines.`);

  const sets = [];
  for (let setIndex = 0; setIndex < setCount; setIndex++) {
    const values = lines[setIndex + 1].split(/\s+/).filter(Boolean).map(Number);
    if (values.length !== 3) throw new Error(`Set ${setIndex + 1} must have exactly three elements.`);
    const seen = new Set();
    const elements = [];
    for (const element of values) {
      if (!Number.isInteger(element) || element < 1 || element > universeSize) {
        throw new Error(`Invalid element ${element} in set ${setIndex + 1}.`);
      }
      if (seen.has(element)) throw new Error(`Set ${setIndex + 1} must have three distinct elements.`);
      seen.add(element);
      elements.push(element);
    }
    sets.push(elements);
  }
  return { universeSize, setCount, padding, sets };
}

function parseGraphColoring(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  if (!lines.length) throw new Error("Graph coloring input is empty.");
  const first = lines[0].split(/\s+/).map(Number);
  if (first.length < 3 || first.length > 4) {
    throw new Error("Graph coloring first line needs: vertices edges colors optional_padding.");
  }
  const n = first[0];
  const edgeCount = first[1];
  const colorCount = first[2];
  const padding = first[3] || 0;
  if (!Number.isInteger(n) || n <= 0) throw new Error("Vertex count must be a positive integer.");
  if (!Number.isInteger(edgeCount) || edgeCount < 0) throw new Error("Edge count must be a nonnegative integer.");
  if (!Number.isInteger(colorCount) || colorCount <= 0) throw new Error("Color count must be a positive integer.");
  if (!Number.isInteger(padding) || padding < 0) throw new Error("Optional padding must be a nonnegative integer.");
  if (lines.length - 1 < edgeCount) throw new Error(`Expected ${edgeCount} edge lines.`);

  const seen = new Set();
  const edges = [];
  for (let index = 0; index < edgeCount; index++) {
    const parts = lines[index + 1].split(/\s+/).filter(Boolean).map(Number);
    if (parts.length !== 2) throw new Error(`Edge ${index + 1} must have exactly two vertices.`);
    let u = parts[0], v = parts[1];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) {
      throw new Error(`Invalid edge ${u} ${v}.`);
    }
    if (u > v) [u, v] = [v, u];
    const key = `${u}:${v}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([u, v]);
  }
  return { n, declaredEdgeCount: edgeCount, colorCount, padding, edges };
}

function findVertexCover(n, k, edges) {
  const chosen = Array(n + 1).fill(false);
  let best = null;

  function uncoveredEdge() {
    for (const [u, v] of edges) {
      if (!chosen[u] && !chosen[v]) return [u, v];
    }
    return null;
  }

  function chosenCount() {
    let count = 0;
    for (let i = 1; i <= n; i++) if (chosen[i]) count++;
    return count;
  }

  function search(count) {
    if (count > k) return false;
    const edge = uncoveredEdge();
    if (!edge) {
      best = [];
      for (let i = 1; i <= n; i++) if (chosen[i]) best.push(i);
      return true;
    }

    const [u, v] = edge;
    chosen[u] = true;
    if (search(count + 1)) return true;
    chosen[u] = false;

    chosen[v] = true;
    if (search(count + 1)) return true;
    chosen[v] = false;
    return false;
  }

  return search(chosenCount()) ? best : null;
}

function buildAdjacencyMatrix(n, edges) {
  const adjacency = Array.from({ length: n + 1 }, () => Array(n + 1).fill(false));
  for (const [u, v] of edges) {
    adjacency[u][v] = true;
    adjacency[v][u] = true;
  }
  return adjacency;
}

function buildComplementEdges(n, edges) {
  const adjacency = buildAdjacencyMatrix(n, edges);
  const complement = [];
  for (let u = 1; u <= n; u++) {
    for (let v = u + 1; v <= n; v++) {
      if (!adjacency[u][v]) complement.push([u, v]);
    }
  }
  return complement;
}

function reduceCliqueByCore(n, k, edges) {
  if (k <= 1) {
    return {
      n,
      edges: normalizeUndirectedEdges(n, edges),
      vertexMap: Array.from({ length: n }, (_, index) => index + 1),
      removed: 0
    };
  }

  const normalized = normalizeUndirectedEdges(n, edges);
  const adjacency = Array.from({ length: n + 1 }, () => new Set());
  for (const [u, v] of normalized) {
    adjacency[u].add(v);
    adjacency[v].add(u);
  }

  const active = Array(n + 1).fill(true);
  active[0] = false;
  let removed = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let vertex = 1; vertex <= n; vertex++) {
      if (!active[vertex]) continue;
      let activeDegree = 0;
      for (const neighbor of adjacency[vertex]) if (active[neighbor]) activeDegree += 1;
      if (activeDegree < k - 1) {
        active[vertex] = false;
        removed += 1;
        changed = true;
      }
    }
  }

  const vertexMap = [];
  const remap = Array(n + 1).fill(0);
  for (let vertex = 1; vertex <= n; vertex++) {
    if (!active[vertex]) continue;
    remap[vertex] = vertexMap.length + 1;
    vertexMap.push(vertex);
  }

  const reducedEdges = [];
  for (const [u, v] of normalized) {
    if (!active[u] || !active[v]) continue;
    reducedEdges.push([remap[u], remap[v]]);
  }

  return {
    n: vertexMap.length,
    edges: reducedEdges,
    vertexMap,
    removed
  };
}

function reduceIndependentSetByCore(n, k, edges) {
  if (k <= 1) {
    return {
      n,
      edges: normalizeUndirectedEdges(n, edges),
      vertexMap: Array.from({ length: n }, (_, index) => index + 1),
      removed: 0
    };
  }

  const normalized = normalizeUndirectedEdges(n, edges);
  const adjacency = Array.from({ length: n + 1 }, () => new Set());
  for (const [u, v] of normalized) {
    adjacency[u].add(v);
    adjacency[v].add(u);
  }

  const active = Array(n + 1).fill(true);
  active[0] = false;
  let removed = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let vertex = 1; vertex <= n; vertex++) {
      if (!active[vertex]) continue;
      let activeNonNeighbors = 0;
      for (let other = 1; other <= n; other++) {
        if (other !== vertex && active[other] && !adjacency[vertex].has(other)) activeNonNeighbors += 1;
      }
      if (activeNonNeighbors < k - 1) {
        active[vertex] = false;
        removed += 1;
        changed = true;
      }
    }
  }

  const vertexMap = [];
  const remap = Array(n + 1).fill(0);
  for (let vertex = 1; vertex <= n; vertex++) {
    if (!active[vertex]) continue;
    remap[vertex] = vertexMap.length + 1;
    vertexMap.push(vertex);
  }

  const reducedEdges = [];
  for (const [u, v] of normalized) {
    if (!active[u] || !active[v]) continue;
    reducedEdges.push([remap[u], remap[v]]);
  }

  return {
    n: vertexMap.length,
    edges: reducedEdges,
    vertexMap,
    removed
  };
}

function greedyMatchingLowerBound(edges) {
  const used = new Set();
  let count = 0;
  for (const [u, v] of edges) {
    if (used.has(u) || used.has(v)) continue;
    used.add(u);
    used.add(v);
    count += 1;
  }
  return count;
}

function reduceVertexCoverBySafeRules(n, k, edges) {
  const normalized = normalizeUndirectedEdges(n, edges);
  const active = Array(n + 1).fill(true);
  active[0] = false;
  const forcedCover = [];
  let removedIsolated = 0;
  let forcedHighDegree = 0;
  let remainingK = k;
  let impossibleReason = "";

  const currentEdgesAndDegree = () => {
    const degree = Array(n + 1).fill(0);
    const remainingEdges = [];
    for (const [u, v] of normalized) {
      if (!active[u] || !active[v]) continue;
      remainingEdges.push([u, v]);
      degree[u] += 1;
      degree[v] += 1;
    }
    return { degree, remainingEdges };
  };

  let changed = true;
  while (changed && !impossibleReason) {
    changed = false;
    const { degree } = currentEdgesAndDegree();
    for (let vertex = 1; vertex <= n; vertex++) {
      if (!active[vertex] || degree[vertex] !== 0) continue;
      active[vertex] = false;
      removedIsolated += 1;
      changed = true;
    }
    if (changed) continue;

    for (let vertex = 1; vertex <= n; vertex++) {
      if (!active[vertex] || degree[vertex] <= remainingK) continue;
      forcedCover.push(vertex);
      active[vertex] = false;
      remainingK -= 1;
      forcedHighDegree += 1;
      changed = true;
      if (remainingK < 0) {
        impossibleReason = `forced more than k=${k} vertices into the cover`;
      }
      break;
    }
  }

  const { remainingEdges } = currentEdgesAndDegree();
  const matchingLowerBound = greedyMatchingLowerBound(remainingEdges);
  if (!impossibleReason && matchingLowerBound > remainingK) {
    impossibleReason = `matching lower bound ${matchingLowerBound} is larger than remaining k=${remainingK}`;
  }

  const vertexMap = [];
  const remap = Array(n + 1).fill(0);
  for (let vertex = 1; vertex <= n; vertex++) {
    if (!active[vertex]) continue;
    remap[vertex] = vertexMap.length + 1;
    vertexMap.push(vertex);
  }

  const reducedEdges = [];
  for (const [u, v] of remainingEdges) {
    reducedEdges.push([remap[u], remap[v]]);
  }

  return {
    n: vertexMap.length,
    k: remainingK,
    edges: reducedEdges,
    vertexMap,
    forcedCover: forcedCover.sort((a, b) => a - b),
    removedIsolated,
    forcedHighDegree,
    matchingLowerBound,
    impossible: Boolean(impossibleReason),
    impossibleReason
  };
}

function reduceSetCoverBySafeRules(universeSize, k, sets) {
  const remainingElements = new Set(Array.from({ length: universeSize }, (_, index) => index + 1));
  let activeSetIndices = sets.map((_, index) => index);
  const forcedSets = [];
  let remainingK = k;
  let impossibleReason = "";
  let changed = true;

  while (changed && !impossibleReason) {
    changed = false;
    const coveringByElement = Array.from({ length: universeSize + 1 }, () => []);
    for (const setIndex of activeSetIndices) {
      for (const element of sets[setIndex]) {
        if (remainingElements.has(element)) coveringByElement[element].push(setIndex);
      }
    }

    for (const element of remainingElements) {
      const covering = coveringByElement[element];
      if (covering.length === 0) {
        impossibleReason = `element ${element} is not contained in any remaining set`;
        break;
      }
      if (covering.length === 1) {
        const forcedIndex = covering[0];
        if (!forcedSets.includes(forcedIndex)) {
          forcedSets.push(forcedIndex);
          remainingK -= 1;
          if (remainingK < 0) {
            impossibleReason = `forced more than k=${k} sets`;
            break;
          }
        }
        for (const covered of sets[forcedIndex]) remainingElements.delete(covered);
        activeSetIndices = activeSetIndices.filter(index => index !== forcedIndex);
        changed = true;
        break;
      }
    }

    activeSetIndices = activeSetIndices.filter(index => sets[index].some(element => remainingElements.has(element)));
  }

  if (!impossibleReason && remainingElements.size > 0) {
    let maxSetSize = 0;
    for (const setIndex of activeSetIndices) {
      let size = 0;
      for (const element of sets[setIndex]) if (remainingElements.has(element)) size += 1;
      maxSetSize = Math.max(maxSetSize, size);
    }
    if (maxSetSize === 0) {
      impossibleReason = "no remaining set covers an uncovered element";
    } else {
      const lowerBound = Math.ceil(remainingElements.size / maxSetSize);
      if (lowerBound > remainingK) impossibleReason = `set-cover lower bound ${lowerBound} is larger than remaining k=${remainingK}`;
    }
  }

  const elementMap = Array.from(remainingElements).sort((a, b) => a - b);
  const elementRemap = Array(universeSize + 1).fill(0);
  elementMap.forEach((element, index) => {
    elementRemap[element] = index + 1;
  });

  const setMap = [];
  const reducedSets = [];
  for (const setIndex of activeSetIndices) {
    const reducedSet = [];
    const seen = new Set();
    for (const element of sets[setIndex]) {
      const mapped = elementRemap[element];
      if (!mapped || seen.has(mapped)) continue;
      seen.add(mapped);
      reducedSet.push(mapped);
    }
    if (reducedSet.length === 0) continue;
    setMap.push(setIndex + 1);
    reducedSets.push(reducedSet);
  }

  return {
    universeSize: elementMap.length,
    setCount: reducedSets.length,
    k: remainingK,
    sets: reducedSets,
    elementMap,
    setMap,
    forcedSets: forcedSets.map(index => index + 1).sort((a, b) => a - b),
    impossible: Boolean(impossibleReason),
    impossibleReason
  };
}

function reduceX3cBySafeRules(universeSize, sets) {
  if (universeSize % 3 !== 0) {
    return {
      universeSize,
      setCount: sets.length,
      sets,
      elementMap: Array.from({ length: universeSize }, (_, index) => index + 1),
      setMap: sets.map((_, index) => index + 1),
      forcedSets: [],
      targetSetCount: "not integral",
      impossible: true,
      impossibleReason: `universe size ${universeSize} is not divisible by 3`
    };
  }

  const targetSetCount = universeSize / 3;
  const remainingElements = new Set(Array.from({ length: universeSize }, (_, index) => index + 1));
  let activeSetIndices = sets.map((_, index) => index);
  const forcedSets = [];
  let impossibleReason = "";
  let changed = true;

  while (changed && !impossibleReason) {
    changed = false;
    const coveringByElement = Array.from({ length: universeSize + 1 }, () => []);
    for (const setIndex of activeSetIndices) {
      for (const element of sets[setIndex]) {
        if (remainingElements.has(element)) coveringByElement[element].push(setIndex);
      }
    }

    for (const element of remainingElements) {
      const covering = coveringByElement[element];
      if (covering.length === 0) {
        impossibleReason = `element ${element} is not contained in any remaining 3-set`;
        break;
      }
      if (covering.length === 1) {
        const forcedIndex = covering[0];
        if (!forcedSets.includes(forcedIndex)) forcedSets.push(forcedIndex);
        if (forcedSets.length > targetSetCount) {
          impossibleReason = `forced more than target=${targetSetCount} 3-sets`;
          break;
        }
        const forcedElements = new Set(sets[forcedIndex]);
        for (const covered of forcedElements) remainingElements.delete(covered);
        activeSetIndices = activeSetIndices.filter(index =>
          index !== forcedIndex && !sets[index].some(item => forcedElements.has(item)));
        changed = true;
        break;
      }
    }
  }

  const remainingTarget = targetSetCount - forcedSets.length;
  if (!impossibleReason && remainingElements.size !== remainingTarget * 3) {
    impossibleReason = `remaining uncovered element count ${remainingElements.size} does not match remaining target ${remainingTarget} 3-sets`;
  }
  if (!impossibleReason && remainingElements.size > 0 && activeSetIndices.length < remainingTarget) {
    impossibleReason = `only ${activeSetIndices.length} remaining 3-sets for target ${remainingTarget}`;
  }

  const elementMap = Array.from(remainingElements).sort((a, b) => a - b);
  const elementRemap = Array(universeSize + 1).fill(0);
  elementMap.forEach((element, index) => {
    elementRemap[element] = index + 1;
  });

  const setMap = [];
  const reducedSets = [];
  for (const setIndex of activeSetIndices) {
    const reducedSet = sets[setIndex].map(element => elementRemap[element]);
    if (reducedSet.some(element => !element)) continue;
    setMap.push(setIndex + 1);
    reducedSets.push(reducedSet);
  }

  return {
    universeSize: elementMap.length,
    setCount: reducedSets.length,
    sets: reducedSets,
    elementMap,
    setMap,
    forcedSets: forcedSets.map(index => index + 1).sort((a, b) => a - b),
    targetSetCount,
    impossible: Boolean(impossibleReason),
    impossibleReason
  };
}

function normalizeUndirectedEdges(n, edges) {
  const seen = new Set();
  const normalized = [];
  for (const edgePair of edges) {
    let [u, v] = edgePair;
    if (u > v) [u, v] = [v, u];
    if (u < 1 || v < 1 || u > n || v > n || u === v) continue;
    const key = `${u}:${v}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push([u, v]);
  }
  return normalized;
}

function buildYesTriangleGraph() {
  const edge = makeMatrix(3);
  const allowedEdgeKeys = new Set();
  const allowedEdges = [];
  const add = (from, to) => {
    edge[from][to] = -1;
    edge[to][from] = -1;
    const key = edgeKey(from, to);
    if (!allowedEdgeKeys.has(key)) {
      allowedEdgeKeys.add(key);
      allowedEdges.push({ from: Math.min(from, to), to: Math.max(from, to), weight: -1, weightSquared: 1, key });
    }
  };
  add(1, 2);
  add(2, 3);
  add(3, 1);
  attachEdgeListAdjacency(allowedEdges, 3);
  return {
    edge,
    n: 3,
    allowedEdgeKeys,
    allowedEdges,
    gadgetCount: 0,
    selectorSlots: 0,
    paddingNodes: 0,
    directYes: true
  };
}

function buildDirectVertexCoverHcGraph(vertexCount, coverLimit, edges, padding = 0) {
  const normalizedEdges = normalizeUndirectedEdges(vertexCount, edges);
  if (normalizedEdges.length === 0) return buildYesTriangleGraph();

  const selectorSlots = Math.min(coverLimit, vertexCount);
  let nextNode = 1;
  const gadgetRows = [];
  const incidentRows = Array.from({ length: vertexCount + 1 }, () => []);

  for (let edgeIndex = 0; edgeIndex < normalizedEdges.length; edgeIndex++) {
    const [u, v] = normalizedEdges[edgeIndex];
    const uRow = Array.from({ length: 6 }, () => nextNode++);
    const vRow = Array.from({ length: 6 }, () => nextNode++);
    const uInfo = { vertex: u, edgeIndex, start: uRow[0], end: uRow[5], nodes: uRow };
    const vInfo = { vertex: v, edgeIndex, start: vRow[0], end: vRow[5], nodes: vRow };
    gadgetRows.push({ u, v, uRow, vRow, uInfo, vInfo });
    incidentRows[u].push(uInfo);
    incidentRows[v].push(vInfo);
  }

  const selectors = [];
  for (let slot = 0; slot < selectorSlots; slot++) {
    selectors.push({ entry: nextNode++, exit: nextNode++ });
  }
  const paddingNodes = Array.from({ length: Math.max(0, padding) }, () => nextNode++);
  const totalNodes = nextNode - 1;
  const edge = makeMatrix(totalNodes);
  const allowedEdgeKeys = new Set();
  const allowedEdges = [];
  const decisionEdgeKeys = new Set();
  const connectorEdgesByVertex = Array.from({ length: vertexCount + 1 }, () => []);
  const neighborsByVertex = Array.from({ length: vertexCount + 1 }, () => new Set());
  const selectedTriggerByEdgeKey = new Map();
  const rejectionPatterns = [];

  const add = (from, to, decision = false) => {
    if (from === to) return "";
    edge[from][to] = -1;
    edge[to][from] = -1;
    const key = edgeKey(from, to);
    if (!allowedEdgeKeys.has(key)) {
      allowedEdgeKeys.add(key);
      allowedEdges.push({
        from: Math.min(from, to),
        to: Math.max(from, to),
        weight: -1,
        weightSquared: 1,
        key
      });
    }
    if (decision) decisionEdgeKeys.add(key);
    return key;
  };

  const pathEdges = nodes => {
    const result = [];
    for (let index = 0; index + 1 < nodes.length; index++) {
      const from = nodes[index];
      const to = nodes[index + 1];
      result.push({ from, to, key: edgeKey(from, to) });
    }
    return result;
  };

  for (const gadget of gadgetRows) {
    neighborsByVertex[gadget.u].add(gadget.v);
    neighborsByVertex[gadget.v].add(gadget.u);
    for (let i = 0; i < 5; i++) {
      add(gadget.uRow[i], gadget.uRow[i + 1]);
      add(gadget.vRow[i], gadget.vRow[i + 1]);
    }
    const u1ToV3 = add(gadget.uRow[0], gadget.vRow[2], true);
    const v1ToU3 = add(gadget.vRow[0], gadget.uRow[2], true);
    const u6ToV4 = add(gadget.uRow[5], gadget.vRow[3], true);
    const u4ToV6 = add(gadget.uRow[3], gadget.vRow[5], true);
    rejectionPatterns.push({
      rejectedVertex: gadget.u,
      coveringVertex: gadget.v,
      crossKeys: [u1ToV3, u6ToV4],
      pathEdges: pathEdges([
        gadget.vRow[0], gadget.vRow[1], gadget.vRow[2],
        gadget.uRow[0], gadget.uRow[1], gadget.uRow[2], gadget.uRow[3], gadget.uRow[4], gadget.uRow[5],
        gadget.vRow[3], gadget.vRow[4], gadget.vRow[5]
      ])
    });
    rejectionPatterns.push({
      rejectedVertex: gadget.v,
      coveringVertex: gadget.u,
      crossKeys: [v1ToU3, u4ToV6],
      pathEdges: pathEdges([
        gadget.uRow[0], gadget.uRow[1], gadget.uRow[2],
        gadget.vRow[0], gadget.vRow[1], gadget.vRow[2], gadget.vRow[3], gadget.vRow[4], gadget.vRow[5],
        gadget.uRow[3], gadget.uRow[4], gadget.uRow[5]
      ])
    });
  }

  const vertexPaths = [];
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    const rows = incidentRows[vertex].sort((a, b) => a.edgeIndex - b.edgeIndex);
    if (rows.length === 0) continue;
    for (let index = 0; index + 1 < rows.length; index++) {
      const key = add(rows[index].end, rows[index + 1].start, true);
      connectorEdgesByVertex[vertex].push({ from: rows[index].end, to: rows[index + 1].start, key });
    }
    vertexPaths.push({
      vertex,
      start: rows[0].start,
      end: rows[rows.length - 1].end,
      rowCount: rows.length
    });
  }

  if (selectorSlots > 0) {
    for (let slot = 0; slot < selectors.length; slot++) {
      const selector = selectors[slot];
      add(selector.entry, selector.exit, true);
      for (const path of vertexPaths) {
        add(selector.entry, path.start, true);
        add(selector.entry, path.end, true);
        add(selector.exit, path.start, true);
        add(selector.exit, path.end, true);
      }
      if (slot + 1 < selectors.length) {
        add(selector.exit, selectors[slot + 1].entry);
      }
    }
    const lastExit = selectors[selectors.length - 1].exit;
    const firstEntry = selectors[0].entry;
    if (paddingNodes.length === 0) {
      add(lastExit, firstEntry);
    } else {
      add(lastExit, paddingNodes[0]);
      for (let index = 0; index + 1 < paddingNodes.length; index++) add(paddingNodes[index], paddingNodes[index + 1]);
      add(paddingNodes[paddingNodes.length - 1], firstEntry);
    }
  }

  const rejectionDecisionEdgeKeys = new Set();
  for (const pattern of rejectionPatterns) {
    pattern.crossKeys.forEach(key => rejectionDecisionEdgeKeys.add(key));
  }

  attachEdgeListAdjacency(allowedEdges, totalNodes);
  return {
    edge,
    n: totalNodes,
    allowedEdgeKeys,
    allowedEdges,
    decisionEdgeKeys,
    gadgetCount: normalizedEdges.length,
    selectorSlots,
    selectors,
    paddingNodes: paddingNodes.length,
    vertexPaths,
    normalizedEdges,
    vertexCoverPropagation: {
      coverLimit,
      connectorEdgesByVertex,
      neighborsByVertex: neighborsByVertex.map(neighbors => Array.from(neighbors)),
      selectedTriggerByEdgeKey,
      rejectionDecisionEdgeKeys,
      rejectionPatterns
    }
  };
}

function findClique(n, k, edges) {
  if (k === 0) return [];
  if (k > n) return null;
  const adjacency = buildAdjacencyMatrix(n, edges);

  function search(clique, candidates) {
    if (clique.length === k) return clique.slice();
    while (candidates.length > 0) {
      if (clique.length + candidates.length < k) return null;
      const vertex = candidates.shift();
      const nextCandidates = candidates.filter(candidate => adjacency[vertex][candidate]);
      const found = search([...clique, vertex], nextCandidates);
      if (found) return found;
    }
    return null;
  }

  const candidates = [];
  for (let vertex = 1; vertex <= n; vertex++) candidates.push(vertex);
  return search([], candidates);
}

function findSetCover(universeSize, k, sets) {
  const covered = Array(universeSize + 1).fill(false);
  const chosen = [];

  function firstUncoveredElement() {
    for (let element = 1; element <= universeSize; element++) {
      if (!covered[element]) return element;
    }
    return 0;
  }

  function search() {
    const element = firstUncoveredElement();
    if (element === 0) return chosen.slice();
    if (chosen.length >= k) return null;

    for (let setIndex = 0; setIndex < sets.length; setIndex++) {
      if (!sets[setIndex].includes(element) || chosen.includes(setIndex + 1)) continue;
      const newlyCovered = [];
      for (const value of sets[setIndex]) {
        if (!covered[value]) {
          covered[value] = true;
          newlyCovered.push(value);
        }
      }
      chosen.push(setIndex + 1);
      const found = search();
      if (found) return found;
      chosen.pop();
      for (const value of newlyCovered) covered[value] = false;
    }
    return null;
  }

  return search();
}

function findX3c(universeSize, sets) {
  if (universeSize % 3 !== 0) return null;
  const targetSetCount = universeSize / 3;
  const covered = Array(universeSize + 1).fill(false);
  const chosen = [];

  function firstUncoveredElement() {
    for (let element = 1; element <= universeSize; element++) {
      if (!covered[element]) return element;
    }
    return 0;
  }

  function search() {
    const element = firstUncoveredElement();
    if (element === 0) return chosen.length === targetSetCount ? chosen.slice() : null;
    if (chosen.length >= targetSetCount) return null;

    for (let setIndex = 0; setIndex < sets.length; setIndex++) {
      if (!sets[setIndex].includes(element) || chosen.includes(setIndex + 1)) continue;
      let canUse = true;
      for (const value of sets[setIndex]) {
        if (covered[value]) {
          canUse = false;
          break;
        }
      }
      if (!canUse) continue;

      for (const value of sets[setIndex]) covered[value] = true;
      chosen.push(setIndex + 1);
      const found = search();
      if (found) return found;
      chosen.pop();
      for (const value of sets[setIndex]) covered[value] = false;
    }
    return null;
  }

  return search();
}

function findGraphColoring(n, colorCount, edges) {
  const adjacency = Array.from({ length: n + 1 }, () => []);
  for (const [u, v] of edges) {
    adjacency[u].push(v);
    adjacency[v].push(u);
  }
  const order = Array.from({ length: n }, (_, index) => index + 1)
    .sort((a, b) => adjacency[b].length - adjacency[a].length);
  const color = Array(n + 1).fill(0);

  function canUse(vertex, candidateColor) {
    for (const neighbor of adjacency[vertex]) {
      if (color[neighbor] === candidateColor) return false;
    }
    return true;
  }

  function search(position) {
    if (position === order.length) return true;
    const vertex = order[position];
    for (let candidateColor = 1; candidateColor <= colorCount; candidateColor++) {
      if (!canUse(vertex, candidateColor)) continue;
      color[vertex] = candidateColor;
      if (search(position + 1)) return true;
      color[vertex] = 0;
    }
    return false;
  }

  return search(0) ? color : null;
}

function witnessDisplayLimit() {
  return Math.max(1, Math.floor(getHcBacktrackTries()));
}

function collectSatisfyingAssignments(variableCount, clauses, limit) {
  const results = [];
  const assignment = Array(variableCount + 1).fill(-1);

  function search() {
    if (results.length >= limit || !partialFormulaCanStillBeSatisfied(clauses, assignment)) return;
    let variable = 0;
    for (let i = 1; i <= variableCount; i++) {
      if (assignment[i] === -1) {
        variable = i;
        break;
      }
    }
    if (variable === 0) {
      if (formulaIsSatisfied(clauses, assignment)) results.push(assignment.slice());
      return;
    }
    assignment[variable] = 1;
    search();
    assignment[variable] = 0;
    search();
    assignment[variable] = -1;
  }

  search();
  return results;
}

function copySatAssignment(assignment) {
  return assignment ? assignment.slice() : [];
}

function convertSimplifiedAssignment(assignment, variableCount) {
  const result = Array(variableCount + 1).fill(-1);
  if (!assignment) return result;
  for (let variable = 1; variable <= variableCount; variable++) {
    if (assignment[variable] === 1) result[variable] = 1;
    else if (assignment[variable] === -1) result[variable] = 0;
  }
  return result;
}

function mergeSatAssignment(target, source, variableCount) {
  for (let variable = 1; variable <= variableCount; variable++) {
    const value = source[variable];
    if (value === -1 || value === undefined) continue;
    if (target[variable] !== -1 && target[variable] !== value) return false;
    target[variable] = value;
  }
  return true;
}

function countAssignedSatVariables(assignment, variableCount) {
  let count = 0;
  for (let variable = 1; variable <= variableCount; variable++) {
    if (assignment[variable] !== -1) count += 1;
  }
  return count;
}

function satAssignmentSignature(assignment, variableCount) {
  const parts = [];
  for (let variable = 1; variable <= variableCount; variable++) {
    const value = assignment[variable];
    parts.push(value === -1 ? "?" : (value === 1 ? "1" : "0"));
  }
  return parts.join("");
}

function satAssignmentFromVcState(state, meta) {
  const variableCount = Math.max(0, Math.floor(Number(meta.satVariableCount || 0)));
  const literalByVertex = meta.satLiteralByVertex || [];
  const assignment = Array(variableCount + 1).fill(-1);
  let conflict = false;
  const setValue = (variable, value) => {
    if (variable < 1 || variable > variableCount) return;
    if (assignment[variable] !== -1 && assignment[variable] !== value) {
      conflict = true;
      return;
    }
    assignment[variable] = value;
  };

  const selected = state.vcSelectedVertices || new Set();
  for (const vertex of selected) {
    const literal = literalByVertex[vertex];
    if (!literal) continue;
    setValue(literal.variable, literal.sign > 0 ? 1 : 0);
  }

  const rejected = state.vcRejectedVertices || new Set();
  for (const vertex of rejected) {
    const literal = literalByVertex[vertex];
    if (!literal) continue;
    setValue(literal.variable, literal.sign > 0 ? 0 : 1);
  }

  return { assignment, conflict };
}

function satValueFromCoveringLiteral(literal) {
  return literal.sign > 0 ? 1 : 0;
}

function buildSatDecisionCandidates(graph) {
  const meta = graph.vertexCoverPropagation;
  if (!meta || !meta.satDecisionEdgeKeys) return [];
  const edgeByKey = new Map((graph.allowedEdges || []).map(item => [item.key, item]));
  const literalByVertex = meta.satLiteralByVertex || [];
  const candidates = [];
  const seen = new Set();

  for (const pattern of meta.rejectionPatterns) {
    const key = pattern.crossKeys[0];
    if (!meta.satDecisionEdgeKeys.has(key) || seen.has(key)) continue;
    const edgeChoices = pattern.crossKeys
      .map(crossKey => edgeByKey.get(crossKey))
      .filter(Boolean);
    const edgeInfo = edgeChoices[0];
    const rejected = literalByVertex[pattern.rejectedVertex];
    const covering = literalByVertex[pattern.coveringVertex];
    if (!edgeInfo || !rejected || !covering) continue;
    if (rejected.variable !== covering.variable || rejected.sign === covering.sign) continue;
    seen.add(key);
    candidates.push({
      ...edgeInfo,
      variable: rejected.variable,
      value: satValueFromCoveringLiteral(covering),
      pattern,
      edgeChoices
    });
  }

  candidates.sort((a, b) => a.variable - b.variable || b.value - a.value);
  return candidates;
}

function satDecisionEdgeAvailable(edgeInfo, edge, endpointLink) {
  return Boolean(edgeInfo &&
    endpointLink[edgeInfo.from] !== -1 &&
    endpointLink[edgeInfo.to] !== -1 &&
    endpointLink[edgeInfo.from] !== edgeInfo.to &&
    endpointLink[edgeInfo.to] !== edgeInfo.from &&
    edge[edgeInfo.from][edgeInfo.to] !== 0);
}

function currentSatDecisionCandidateEdges(candidates, assignment, graph, endpointLink) {
  const result = [];
  for (const candidate of candidates) {
    if (assignment[candidate.variable] !== -1) continue;
    const edgeInfo = candidate.edgeChoices.find(choice => satDecisionEdgeAvailable(choice, graph.edge, endpointLink));
    if (!edgeInfo) continue;
    result.push({
      ...candidate,
      from: edgeInfo.from,
      to: edgeInfo.to,
      weight: edgeInfo.weight,
      weightSquared: edgeInfo.weightSquared,
      key: edgeInfo.key
    });
  }
  return result;
}

function satDecisionLabel(candidate) {
  return `x${candidate.variable}=${candidate.value === 1 ? "true" : "false"}`;
}

function setSatBranchAssignment(branch, variable, value, reason) {
  if (branch.assignment[variable] !== -1 && branch.assignment[variable] !== value) {
    branch.state.invalid = true;
    branch.state.invalidReason = reason || `SAT witness assignment conflicts at x${variable}.`;
    return false;
  }
  branch.assignment[variable] = value;
  return true;
}

function applySatDecisionEdgeChoice(branch, candidate, graph, forcedBy = "") {
  if (!applyChosenEdge(candidate.from, candidate.to, graph.edge, branch.endpointLink, branch.state)) {
    branch.state.invalid = true;
    branch.state.invalidReason = `SAT witness choice ${satDecisionLabel(candidate)} could not be applied.`;
    return false;
  }
  if (!setSatBranchAssignment(branch, candidate.variable, candidate.value,
      `SAT witness choice ${satDecisionLabel(candidate)} conflicts with an earlier witness choice.`)) return false;
  branch.decisions.push({
    variable: candidate.variable,
    value: candidate.value,
    edge: { from: candidate.from, to: candidate.to },
    forcedEdges: 0,
    forcedBy
  });
  return true;
}

function applySatDecisionCandidate(branch, candidate, graph, searchOptions, applyFollowUps = true) {
  const firstDecisionIndex = branch.decisions.length;
  if (!applySatDecisionEdgeChoice(branch, candidate, graph)) return false;

  if (applyFollowUps && searchOptions.satForcedDecisionsAfterChoice) {
    const consequence = searchOptions.satForcedDecisionsAfterChoice(candidate, branch.assignment, branch) || [];
    if (!Array.isArray(consequence) && consequence.valid === false) {
      branch.state.invalid = true;
      branch.state.invalidReason = consequence.reason || `SAT witness consequence proves ${satDecisionLabel(candidate)} impossible.`;
      return false;
    }
    const forcedDecisions = Array.isArray(consequence)
      ? consequence
      : (consequence.forcedDecisions || consequence.forced || []);
    for (const forcedDecision of forcedDecisions) {
      const variable = forcedDecision.variable;
      const value = forcedDecision.value;
      if (branch.assignment[variable] === value) continue;
      if (branch.assignment[variable] !== -1) {
        branch.state.invalid = true;
        branch.state.invalidReason = `SAT witness consequence conflicts at x${variable}.`;
        return false;
      }
      const available = currentSatDecisionCandidateEdges(searchOptions.satAllDecisionCandidates || [], branch.assignment, graph, branch.endpointLink);
      const forcedCandidate = available.find(item => item.variable === variable && item.value === value);
      if (!forcedCandidate) {
        branch.state.invalid = true;
        branch.state.invalidReason = `SAT witness consequence could not force x${variable}=${value === 1 ? "true" : "false"}.`;
        return false;
      }
      if (!applySatDecisionEdgeChoice(branch, forcedCandidate, graph, satDecisionLabel(candidate))) return false;
    }
  }

  if (searchOptions.satWitnessOnlyPropagation) return true;

  const forced = propagateConfiguredForcedEdges(graph.edge, graph.n, branch.endpointLink, branch.state, searchOptions);
  if (branch.state.invalid) return false;
  const inferred = satAssignmentFromVcState(branch.state, searchOptions.vertexCoverPropagation);
  if (inferred.conflict || !mergeSatAssignment(branch.assignment, inferred.assignment, searchOptions.satVariableCount)) {
    branch.state.invalid = true;
    branch.state.invalidReason = `SAT witness choice ${satDecisionLabel(candidate)} conflicts with an earlier witness choice.`;
    return false;
  }
  if (branch.decisions[firstDecisionIndex]) {
    branch.decisions[firstDecisionIndex].forcedEdges += forced.forcedEdgeCount;
  }
  return true;
}

function cloneSatDecisionBranch(branch) {
  return {
    endpointLink: branch.endpointLink.slice(),
    state: cloneSolverState(branch.state),
    assignment: copySatAssignment(branch.assignment),
    decisions: branch.decisions.slice(),
    penalty: branch.penalty,
    lastAdaptiveBeta: branch.lastAdaptiveBeta
  };
}

function prepareSatDecisionAlternative(branch, rankedInfo, graph, searchOptions, clauses) {
  const candidate = rankedInfo.satDecision;
  const alternative = cloneSatDecisionBranch(branch);
  alternative.penalty = branch.penalty + scoreRegret(rankedInfo.best, rankedInfo.candidate) + (rankedInfo.optionIndex * 1e-9);
  if (!applySatDecisionCandidate(alternative, candidate, graph, searchOptions)) return null;
  if (!partialFormulaCanStillBeSatisfied(clauses, alternative.assignment)) return null;
  if (searchOptions.satPartialValidator && !searchOptions.satPartialValidator(alternative.assignment, alternative)) return null;
  return alternative;
}

function runSatWitnessHcDecisionSearch(prepared, formulaVariableCount, formulaClauses, options = {}) {
  const graph = prepared.graph;
  const meta = graph.vertexCoverPropagation;
  const variableCount = Math.max(formulaVariableCount, prepared.simplified.variableCount || formulaVariableCount);
  const requestedDecisionVariableCount = options.decisionVariableCount === undefined
    ? formulaVariableCount
    : options.decisionVariableCount;
  const decisionVariableCount = Math.max(0, Math.min(variableCount, Math.floor(Number(requestedDecisionVariableCount))));
  const assignmentValidator = options.assignmentValidator || ((assignment) => formulaIsSatisfied(formulaClauses, assignment));
  const partialAssignmentValidator = options.partialAssignmentValidator || null;
  meta.witnessKind = "sat";
  meta.witnessTargetSize = variableCount;
  meta.satVariableCount = variableCount;

  const graphEdgeList = graph.allowedEdges || buildNonzeroEdgeList(graph.edge, graph.n);
  attachEdgeListAdjacency(graphEdgeList, graph.n);
  const allSatDecisionCandidates = buildSatDecisionCandidates(graph);
  const satDecisionCandidates = allSatDecisionCandidates
    .filter(candidate => candidate.variable <= decisionVariableCount);
  const baseMoments = computeTheoryMomentsFromEdgeList(graphEdgeList, graph.n);
  const beta = 1.0 / Math.sqrt(Math.max(Number.MIN_VALUE, baseMoments.tourVariance));
  const requestedBacktracks = Math.max(0, Math.floor(getHcBacktrackTries()));
  const branchLimit = Math.max(1, requestedBacktracks);
  const domainForcedDecisionsAfterChoice = options.forcedDecisionsAfterChoice || null;
  const forcedDecisionsAfterChoice = (candidate, assignment, branch) => {
    const working = assignment.slice();
    const forcedDecisions = [];
    const addForcedDecision = decision => {
      if (!decision) return { valid: true };
      const variable = decision.variable;
      const value = decision.value;
      if (!Number.isInteger(variable) || variable < 1 || variable > variableCount) return { valid: true };
      if (value !== 0 && value !== 1) return { valid: true };
      if (working[variable] !== -1 && working[variable] !== value) {
        return {
          valid: false,
          reason: `SAT witness consequence conflicts at x${variable}.`
        };
      }
      if (working[variable] === -1) {
        working[variable] = value;
        forcedDecisions.push({ variable, value });
      }
      return { valid: true };
    };

    if (domainForcedDecisionsAfterChoice) {
      const domainResult = domainForcedDecisionsAfterChoice(candidate, assignment, branch) || [];
      if (!Array.isArray(domainResult) && domainResult.valid === false) {
        return domainResult;
      }
      const domainForced = Array.isArray(domainResult)
        ? domainResult
        : (domainResult.forcedDecisions || domainResult.forced || []);
      for (const decision of domainForced) {
        const added = addForcedDecision(decision);
        if (!added.valid) return added;
      }
    }

    const unitResult = satUnitForcedDecisionsFromAssignment(formulaClauses, working);
    if (!unitResult.valid) return unitResult;
    for (const decision of unitResult.forcedDecisions) {
      const added = addForcedDecision(decision);
      if (!added.valid) return added;
    }

    return { valid: true, forcedDecisions };
  };
  const searchOptions = {
    forceDegreeTwo: true,
    allowedEdgeKeys: graph.allowedEdgeKeys || null,
    allowedEdges: graph.allowedEdges || null,
    momentEdgeList: graphEdgeList,
    vertexCoverPropagation: meta,
    effectiveBeta: beta,
    adaptiveBeta: true,
    betaMultiplier: 1,
    scoreMethod: "importance",
    satVariableCount: variableCount,
    satPartialValidator: partialAssignmentValidator,
    satAllDecisionCandidates: allSatDecisionCandidates,
    satDecisionCandidateFilter: options.decisionCandidateFilter || null,
    satForcedDecisionsAfterChoice: forcedDecisionsAfterChoice,
    satWitnessOnlyPropagation: options.satWitnessOnlyPropagation !== false
  };

  const rootEndpointLink = Array(graph.n + 1).fill(0);
  const rootState = {
    closedChains: 0,
    usedVertices: 0,
    chosenEdgeTotal: 0,
    chosenEdges: [],
    allowedEdgeKeys: graph.allowedEdgeKeys,
    allowedEdges: graph.allowedEdges
  };
  const initialForced = propagateConfiguredForcedEdges(graph.edge, graph.n, rootEndpointLink, rootState, searchOptions);
  const baseAssignment = convertSimplifiedAssignment(prepared.simplified.assignment, variableCount);
  const rootInferred = satAssignmentFromVcState(rootState, meta);
  let rootConflict = rootInferred.conflict || !mergeSatAssignment(baseAssignment, rootInferred.assignment, variableCount);

  const queue = [{
    endpointLink: rootEndpointLink,
    state: rootState,
    assignment: baseAssignment,
    decisions: [],
    penalty: 0,
    lastAdaptiveBeta: beta
  }];
  const seenQueuedAssignments = new Set([satAssignmentSignature(baseAssignment, decisionVariableCount)]);
  const satisfyingAssignments = [];
  const satisfyingSeen = new Set();
  let explored = 0;
  let queued = 1;
  let assignmentsChecked = 0;
  let bestFailureReason = rootConflict ? "initial SAT/VC witness propagation conflict" : "";

  while (!rootConflict && queue.length > 0 && explored < branchLimit) {
    queue.sort((a, b) => a.penalty - b.penalty);
    const branch = queue.shift();
    explored += 1;

    while (!branch.state.invalid) {
      if (!partialFormulaCanStillBeSatisfied(formulaClauses, branch.assignment)) {
        bestFailureReason = "partial assignment already falsifies a clause";
        break;
      }
      if (partialAssignmentValidator && !partialAssignmentValidator(branch.assignment, branch)) {
        bestFailureReason = "partial original decision witness is already impossible";
        break;
      }

      let remainingDecisions = currentSatDecisionCandidateEdges(satDecisionCandidates, branch.assignment, graph, branch.endpointLink);
      if (searchOptions.satDecisionCandidateFilter) {
        remainingDecisions = remainingDecisions.filter(candidate => searchOptions.satDecisionCandidateFilter(candidate, branch.assignment, branch));
      }
      if (remainingDecisions.length > 0) {
        remainingDecisions = remainingDecisions.filter(candidate =>
          satDecisionFormulaPrecheck(candidate, branch.assignment, formulaClauses, partialAssignmentValidator, branch));
        if (remainingDecisions.length === 0) {
          bestFailureReason = "all remaining SAT witness choices are exactly impossible";
          break;
        }
      }
      if (remainingDecisions.length === 0) {
        assignmentsChecked += 1;
        if (assignmentValidator(branch.assignment, branch)) {
          const signature = satAssignmentSignature(branch.assignment, decisionVariableCount);
          if (!satisfyingSeen.has(signature)) {
            satisfyingSeen.add(signature);
            satisfyingAssignments.push({
              assignment: branch.assignment.slice(),
              decisionAssignment: branch.assignment.slice(0, decisionVariableCount + 1),
              decisions: branch.decisions.slice(),
              chosenEdges: branch.state.chosenEdges ? branch.state.chosenEdges.slice() : [],
              totalForcedEdges: branch.state.chosenEdges ? branch.state.chosenEdges.length : 0
            });
          }
        } else {
          bestFailureReason = "completed witness choices did not satisfy the original decision check";
        }
        break;
      }

      const betaInfo = resolveStepBeta(graph.n, graph.edge, null, branch.endpointLink, branch.state, searchOptions, branch.lastAdaptiveBeta);
      branch.lastAdaptiveBeta = betaInfo.lastAdaptiveBeta;
      const scoringOptions = {
        ...searchOptions,
        currentStats: betaInfo.currentStats,
        candidateEdgeList: remainingDecisions
      };
      const currentDecisionByKey = new Map(remainingDecisions.map(candidate => [candidate.key, candidate]));
      const ranked = rankScoringEdges(graph.n, graph.edge, null, branch.endpointLink, branch.state, betaInfo.beta, null, scoringOptions)
        .map(candidate => ({ ...candidate, satDecision: currentDecisionByKey.get(edgeKey(candidate.from, candidate.to)) }))
        .filter(candidate => candidate.satDecision);
      if (ranked.length === 0) {
        bestFailureReason = "no remaining SAT witness decision edge could be scored";
        break;
      }

      const branchBeforeDecision = cloneSatDecisionBranch(branch);
      let appliedChoice = null;
      let failedChoiceReason = "";
      for (let optionIndex = 0; optionIndex < ranked.length; optionIndex++) {
        const candidate = ranked[optionIndex];
        const attempt = cloneSatDecisionBranch(branchBeforeDecision);
        const applied =
          applySatDecisionCandidate(attempt, candidate.satDecision, graph, searchOptions) &&
          partialFormulaCanStillBeSatisfied(formulaClauses, attempt.assignment) &&
          (!partialAssignmentValidator || partialAssignmentValidator(attempt.assignment, attempt));
        if (!applied) {
          failedChoiceReason = attempt.state.invalidReason || "SAT witness choice is exactly impossible";
          continue;
        }
        branch.endpointLink = attempt.endpointLink;
        branch.state = attempt.state;
        branch.assignment = attempt.assignment;
        branch.decisions = attempt.decisions;
        branch.lastAdaptiveBeta = attempt.lastAdaptiveBeta;
        appliedChoice = {
          candidate,
          optionIndex,
          signature: satAssignmentSignature(branch.assignment, decisionVariableCount)
        };
        break;
      }

      if (!appliedChoice) {
        bestFailureReason = failedChoiceReason || "no remaining SAT witness decision could be applied";
        break;
      }

      const hasBacktrackRoom = explored + queue.length < branchLimit;
      if (hasBacktrackRoom) {
        const best = appliedChoice.candidate;
        const seenConsequences = new Set([appliedChoice.signature]);
        const alternativesToKeep = shouldStopAtFirstHcTour() ? 2 : ranked.length;
        for (let optionIndex = 0; optionIndex < ranked.length && explored + queue.length < branchLimit; optionIndex++) {
          if (optionIndex === appliedChoice.optionIndex) continue;
          const candidate = ranked[optionIndex];
          const rankedInfo = { candidate, satDecision: candidate.satDecision, best, optionIndex };
          const alternative = prepareSatDecisionAlternative(branchBeforeDecision, rankedInfo, graph, searchOptions, formulaClauses);
          if (!alternative) continue;
          const signature = satAssignmentSignature(alternative.assignment, decisionVariableCount);
          if (seenConsequences.has(signature) || seenQueuedAssignments.has(signature)) continue;
          seenConsequences.add(signature);
          seenQueuedAssignments.add(signature);
          queue.push(alternative);
          queued += 1;
          if (seenConsequences.size > alternativesToKeep) break;
        }
      }
    }

    if (satisfyingAssignments.length > 0 && shouldStopAtFirstHcTour()) break;
  }

  return {
    hamiltonianFound: satisfyingAssignments.length > 0,
    satisfyingAssignments,
    explored,
    queued,
    assignmentsChecked,
    requestedBacktracks,
    branchLimit,
    decisionVariableCount,
    satDecisionChoices: satDecisionCandidates.length,
    initialForcedEdges: initialForced.forcedEdgeCount,
    totalTourCost: satisfyingAssignments.length > 0 ? -graph.n : NaN,
    partialTourCost: rootState.chosenEdgeTotal,
    bestFailureReason
  };
}

function sortedVertexCoverSet(state, vertexCount) {
  const selected = state.vcSelectedVertices || new Set();
  const result = [];
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    if (selected.has(vertex)) result.push(vertex);
  }
  return result;
}

function vertexCoverDecisionSignature(state, vertexCount) {
  const selected = state.vcSelectedVertices || new Set();
  const rejected = state.vcRejectedVertices || new Set();
  const parts = [];
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    parts.push(selected.has(vertex) ? "C" : (rejected.has(vertex) ? "N" : "?"));
  }
  return parts.join("");
}

function vertexCoverWitnessValid(state, vertexCount, coverLimit, edges) {
  const selected = state.vcSelectedVertices || new Set();
  if (selected.size > coverLimit) return false;
  for (const [u, v] of edges) {
    if (!selected.has(u) && !selected.has(v)) return false;
  }
  return true;
}

function currentVertexCoverWitnessCover(state, vertexCount, coverLimit, edges) {
  if (!vertexCoverWitnessValid(state, vertexCount, coverLimit, edges)) return null;
  return sortedVertexCoverSet(state, vertexCount);
}

function vertexCoverPartialWitnessValid(state, coverLimit, edges) {
  const selected = state.vcSelectedVertices || new Set();
  const rejected = state.vcRejectedVertices || new Set();
  if (selected.size > coverLimit) return false;
  for (const [u, v] of edges) {
    if (rejected.has(u) && rejected.has(v)) return false;
  }
  return true;
}

function buildVertexCoverDecisionCandidates(graph, vertexCount) {
  const meta = graph.vertexCoverPropagation;
  if (!meta) return [];
  const edgeByKey = new Map((graph.allowedEdges || []).map(item => [item.key, item]));
  const pathByVertex = new Map((graph.vertexPaths || []).map(path => [path.vertex, path]));
  const candidates = [];

  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    const coverChoices = [];
    const path = pathByVertex.get(vertex);
    if (path) {
      for (const selector of graph.selectors || []) {
        [
          edgeKey(selector.entry, path.start),
          edgeKey(selector.entry, path.end),
          edgeKey(selector.exit, path.start),
          edgeKey(selector.exit, path.end)
        ].forEach(key => {
          const edgeInfo = edgeByKey.get(key);
          if (edgeInfo) coverChoices.push(edgeInfo);
        });
      }
    }
    for (const connector of meta.connectorEdgesByVertex[vertex] || []) {
      const edgeInfo = edgeByKey.get(connector.key);
      if (edgeInfo) coverChoices.push(edgeInfo);
    }
    if (coverChoices.length > 0) {
      candidates.push({
        kind: "cover",
        vertex,
        edgeChoices: coverChoices
      });
    }

    const rejectChoices = [];
    for (const pattern of meta.rejectionPatterns || []) {
      if (pattern.rejectedVertex !== vertex) continue;
      for (const key of pattern.crossKeys) {
        const edgeInfo = edgeByKey.get(key);
        if (edgeInfo) rejectChoices.push(edgeInfo);
      }
    }
    if (rejectChoices.length > 0) {
      candidates.push({
        kind: "reject",
        vertex,
        edgeChoices: rejectChoices
      });
    }
  }

  return candidates;
}

function vertexCoverDecisionWithinCapacity(candidate, state, meta, coverLimit) {
  const selected = state.vcSelectedVertices || new Set();
  const rejected = state.vcRejectedVertices || new Set();
  const rejectedTarget = Math.max(0, Math.floor(Number(meta.witnessTargetSize || 0)));
  const hasRejectedTarget = (meta.witnessKind === "clique" || meta.witnessKind === "independentSet") && rejectedTarget > 0;
  if (candidate.kind === "cover") {
    if (rejected.has(candidate.vertex)) return false;
    const nextSelectedSize = selected.size + (selected.has(candidate.vertex) ? 0 : 1);
    if (nextSelectedSize > coverLimit) return false;
    return !hasRejectedTarget || vertexCountFromMeta(meta, selected, rejected) - nextSelectedSize >= rejectedTarget;
  }

  if (selected.has(candidate.vertex)) return false;
  if (hasRejectedTarget && rejected.size + (rejected.has(candidate.vertex) ? 0 : 1) > rejectedTarget) return false;
  let addedSelected = 0;
  for (const neighbor of meta.neighborsByVertex[candidate.vertex] || []) {
    if (rejected.has(neighbor)) return false;
    if (!selected.has(neighbor)) addedSelected += 1;
  }
  return selected.size + addedSelected <= coverLimit;
}

function vertexCountFromMeta(meta, selected, rejected) {
  if (Number.isFinite(meta.vertexCount)) return meta.vertexCount;
  const neighborCount = Math.max(0, (meta.neighborsByVertex || []).length - 1);
  let maxSeen = neighborCount;
  for (const vertex of selected || []) maxSeen = Math.max(maxSeen, vertex);
  for (const vertex of rejected || []) maxSeen = Math.max(maxSeen, vertex);
  return maxSeen;
}

function vertexCoverRejectedTargetCandidateFeasible(candidate, state, meta, vertexCount) {
  const rejectedTarget = Math.max(0, Math.floor(Number(meta.witnessTargetSize || 0)));
  if ((meta.witnessKind !== "clique" && meta.witnessKind !== "independentSet") || rejectedTarget === 0) return true;
  const selected = state.vcSelectedVertices || new Set();
  const rejected = state.vcRejectedVertices || new Set();
  if (rejected.size >= rejectedTarget) return candidate.kind === "cover";
  if (candidate.kind !== "reject") return false;
  if (selected.has(candidate.vertex)) return false;

  const nextRejected = new Set(rejected);
  nextRejected.add(candidate.vertex);
  if (nextRejected.size > rejectedTarget) return false;
  if (nextRejected.size >= rejectedTarget) return true;

  let compatibleCount = nextRejected.size;
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    if (selected.has(vertex) || nextRejected.has(vertex)) continue;
    let compatible = true;
    for (const chosen of nextRejected) {
      if ((meta.neighborsByVertex[chosen] || []).includes(vertex)) {
        compatible = false;
        break;
      }
    }
    if (compatible) compatibleCount += 1;
  }
  return compatibleCount >= rejectedTarget;
}

function vertexCoverRejectedTargetWitnessCover(state, meta, vertexCount, coverLimit, edges) {
  const rejectedTarget = Math.max(0, Math.floor(Number(meta.witnessTargetSize || 0)));
  if ((meta.witnessKind !== "clique" && meta.witnessKind !== "independentSet") || rejectedTarget === 0) return null;
  const rejected = state.vcRejectedVertices || new Set();
  if (rejected.size < rejectedTarget) return null;
  if (!vertexCoverPartialWitnessValid(state, coverLimit, edges)) return null;
  const cover = [];
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    if (!rejected.has(vertex)) cover.push(vertex);
  }
  return cover.length <= coverLimit ? cover : null;
}

function currentVertexCoverDecisionCandidateEdges(candidates, state, graph, endpointLink, coverLimit) {
  const meta = graph.vertexCoverPropagation;
  const vertexCount = vertexCountFromMeta(meta, state.vcSelectedVertices, state.vcRejectedVertices);
  const selected = state.vcSelectedVertices || new Set();
  const rejected = state.vcRejectedVertices || new Set();
  const result = [];
  for (const candidate of candidates) {
    if (selected.has(candidate.vertex) || rejected.has(candidate.vertex)) continue;
    if (!vertexCoverDecisionWithinCapacity(candidate, state, meta, coverLimit)) continue;
    if (!vertexCoverRejectedTargetCandidateFeasible(candidate, state, meta, vertexCount)) continue;
    if (candidate.kind === "cover" && selected.size >= coverLimit) continue;
    const edgeInfo = candidate.edgeChoices.find(choice => satDecisionEdgeAvailable(choice, graph.edge, endpointLink));
    if (!edgeInfo) continue;
    result.push({
      ...candidate,
      from: edgeInfo.from,
      to: edgeInfo.to,
      weight: edgeInfo.weight,
      weightSquared: edgeInfo.weightSquared,
      key: edgeInfo.key
    });
  }
  return result;
}

function vertexCoverDecisionCoverageGain(candidate, state, edges, meta, coverLimit) {
  const selected = state.vcSelectedVertices || new Set();
  const rejected = state.vcRejectedVertices || new Set();
  const nextSelected = new Set(selected);
  if (candidate.kind === "cover") {
    nextSelected.add(candidate.vertex);
  } else {
    for (const neighbor of meta.neighborsByVertex[candidate.vertex] || []) {
      if (!rejected.has(neighbor)) nextSelected.add(neighbor);
    }
  }
  if (nextSelected.size > coverLimit) return -1000000;
  let gain = 0;
  for (const [u, v] of edges) {
    const wasCovered = selected.has(u) || selected.has(v);
    const wouldCover = nextSelected.has(u) || nextSelected.has(v);
    if (!wasCovered && wouldCover) gain += 1;
  }
  return gain;
}

function vertexCoverDecisionAddedSelectedCount(candidate, state, meta) {
  const selected = state.vcSelectedVertices || new Set();
  const rejected = state.vcRejectedVertices || new Set();
  const nextSelected = new Set(selected);
  if (candidate.kind === "cover") {
    nextSelected.add(candidate.vertex);
  } else {
    for (const neighbor of meta.neighborsByVertex[candidate.vertex] || []) {
      if (!rejected.has(neighbor)) nextSelected.add(neighbor);
    }
  }
  return Math.max(0, nextSelected.size - selected.size);
}

function vertexCoverDecisionLabel(candidate) {
  return candidate.kind === "cover"
    ? `cover(${candidate.vertex})`
    : `not-cover(${candidate.vertex})`;
}

function forceVertexCoverCapacityConsequences(vertexCount, meta, edge, endpointLink, state) {
  const result = { forcedDecisions: 0, forcedEdgeCount: 0 };
  ensureVertexCoverPropagationState(state);
  if ((state.vcSelectedVertices || new Set()).size < meta.coverLimit) return result;
  const chosenKeys = chosenEdgeKeySet(state);
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    if (state.vcSelectedVertices.has(vertex) || state.vcRejectedVertices.has(vertex)) continue;
    const forced = forceVertexCoverRejected(vertex, meta, edge, endpointLink, state, chosenKeys);
    result.forcedDecisions += forced.rejectedVertexCount;
    result.forcedEdgeCount += forced.forcedEdgeCount;
    if (state.invalid) return result;
  }
  return result;
}

function forceVertexCoverRejectedTargetConsequences(vertexCount, meta, edge, endpointLink, state) {
  const result = { forcedDecisions: 0, forcedEdgeCount: 0 };
  ensureVertexCoverPropagationState(state);
  const rejectedTarget = Math.max(0, Math.floor(Number(meta.witnessTargetSize || 0)));
  if ((meta.witnessKind !== "clique" && meta.witnessKind !== "independentSet") || rejectedTarget === 0) return result;
  if ((state.vcRejectedVertices || new Set()).size < rejectedTarget) return result;
  const chosenKeys = chosenEdgeKeySet(state);
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    if (state.vcSelectedVertices.has(vertex) || state.vcRejectedVertices.has(vertex)) continue;
    const forced = forceVertexCoverSelected(vertex, meta, edge, endpointLink, state, chosenKeys);
    result.forcedDecisions += forced.selectedVertexCount;
    result.forcedEdgeCount += forced.forcedEdgeCount;
    if (state.invalid) return result;
  }
  return result;
}

function applyVertexCoverWitnessOnlyDecisionCandidate(branch, candidate, graph, searchOptions) {
  if (!applyChosenEdge(candidate.from, candidate.to, graph.edge, branch.endpointLink, branch.state)) {
    branch.state.invalid = true;
    branch.state.invalidReason = `Vertex Cover witness choice ${vertexCoverDecisionLabel(candidate)} could not be applied.`;
    return false;
  }

  const meta = searchOptions.vertexCoverPropagation;
  ensureVertexCoverPropagationState(branch.state);
  const selected = branch.state.vcSelectedVertices;
  const rejected = branch.state.vcRejectedVertices;
  const coverLimit = meta.coverLimit;
  let forcedDecisionCount = 0;

  const selectVertex = vertex => {
    if (rejected.has(vertex)) {
      branch.state.invalid = true;
      branch.state.invalidReason = `Vertex Cover contradiction: vertex ${vertex} was both chosen and not chosen.`;
      return false;
    }
    if (!selected.has(vertex)) {
      selected.add(vertex);
      forcedDecisionCount += 1;
      if (selected.size > coverLimit) {
        branch.state.invalid = true;
        branch.state.invalidReason = `Vertex Cover propagation selected more than k=${coverLimit} vertices.`;
        return false;
      }
    }
    return true;
  };

  const rejectVertex = vertex => {
    if (selected.has(vertex)) {
      branch.state.invalid = true;
      branch.state.invalidReason = `Vertex Cover contradiction: vertex ${vertex} was both chosen and not chosen.`;
      return false;
    }
    if (!rejected.has(vertex)) {
      rejected.add(vertex);
      forcedDecisionCount += 1;
    }
    return true;
  };

  if (candidate.kind === "cover") {
    if (!selectVertex(candidate.vertex)) return false;
  } else {
    if (!rejectVertex(candidate.vertex)) return false;
    for (const neighbor of meta.neighborsByVertex[candidate.vertex] || []) {
      if (!selectVertex(neighbor)) return false;
    }
  }

  if (selected.size >= coverLimit) {
    for (let vertex = 1; vertex <= searchOptions.vertexCount; vertex++) {
      if (selected.has(vertex) || rejected.has(vertex)) continue;
      if (!rejectVertex(vertex)) return false;
    }
  }

  branch.decisions.push({
    vertex: candidate.vertex,
    kind: candidate.kind,
    edge: { from: candidate.from, to: candidate.to },
    forcedEdges: 0,
    forcedWitnessDecisions: forcedDecisionCount
  });
  return true;
}

function applyVertexCoverDecisionCandidate(branch, candidate, graph, searchOptions) {
  if (searchOptions.vertexCoverPropagation.witnessOnlyPropagation) {
    return applyVertexCoverWitnessOnlyDecisionCandidate(branch, candidate, graph, searchOptions);
  }

  if (!applyChosenEdge(candidate.from, candidate.to, graph.edge, branch.endpointLink, branch.state)) {
    branch.state.invalid = true;
    branch.state.invalidReason = `Vertex Cover witness choice ${vertexCoverDecisionLabel(candidate)} could not be applied.`;
    return false;
  }

  const meta = searchOptions.vertexCoverPropagation;
  const chosenKeys = chosenEdgeKeySet(branch.state);
  let directForced = null;
  if (candidate.kind === "cover") {
    directForced = forceVertexCoverSelected(candidate.vertex, meta, graph.edge, branch.endpointLink, branch.state, chosenKeys);
  } else {
    directForced = forceVertexCoverRejected(candidate.vertex, meta, graph.edge, branch.endpointLink, branch.state, chosenKeys);
  }
  if (branch.state.invalid) return false;

  const propagated = propagateConfiguredForcedEdges(graph.edge, graph.n, branch.endpointLink, branch.state, searchOptions);
  if (branch.state.invalid) return false;
  const capacity = forceVertexCoverCapacityConsequences(searchOptions.vertexCount, meta, graph.edge, branch.endpointLink, branch.state);
  if (branch.state.invalid) return false;
  if (capacity.forcedDecisions > 0 || capacity.forcedEdgeCount > 0) {
    const afterCapacity = propagateConfiguredForcedEdges(graph.edge, graph.n, branch.endpointLink, branch.state, searchOptions);
    if (branch.state.invalid) return false;
    propagated.forcedEdgeCount += afterCapacity.forcedEdgeCount;
  }
  branch.decisions.push({
    vertex: candidate.vertex,
    kind: candidate.kind,
    edge: { from: candidate.from, to: candidate.to },
    forcedEdges: (directForced ? directForced.forcedEdgeCount : 0) + propagated.forcedEdgeCount + capacity.forcedEdgeCount
  });
  return true;
}

function cloneVertexCoverDecisionBranch(branch) {
  return {
    endpointLink: branch.endpointLink.slice(),
    state: cloneSolverState(branch.state),
    decisions: branch.decisions.slice(),
    penalty: branch.penalty,
    lastAdaptiveBeta: branch.lastAdaptiveBeta
  };
}

function prepareVertexCoverDecisionAlternative(branch, rankedInfo, graph, searchOptions, edges) {
  const alternative = cloneVertexCoverDecisionBranch(branch);
  alternative.penalty = branch.penalty + scoreRegret(rankedInfo.best, rankedInfo.candidate) + (rankedInfo.optionIndex * 1e-9);
  if (!applyVertexCoverDecisionCandidate(alternative, rankedInfo.vcDecision, graph, searchOptions)) return null;
  if (!vertexCoverPartialWitnessValid(alternative.state, searchOptions.vertexCoverPropagation.coverLimit, edges)) return null;
  return alternative;
}

function runVertexCoverWitnessHcDecisionSearch(graph, vertexCount, coverLimit, edges) {
  if (!graph.vertexCoverPropagation) {
    const selected = [];
    return {
      hamiltonianFound: edges.length === 0,
      covers: edges.length === 0 ? [{ cover: selected, decisions: [], chosenEdges: [] }] : [],
      explored: 0,
      queued: 0,
      assignmentsChecked: edges.length === 0 ? 1 : 0,
      requestedBacktracks: Math.max(0, Math.floor(getHcBacktrackTries())),
      branchLimit: Math.max(1, Math.max(0, Math.floor(getHcBacktrackTries()))),
      decisionVertices: vertexCount,
      vcDecisionChoices: 0,
      initialForcedEdges: 0,
      totalTourCost: edges.length === 0 ? -graph.n : NaN,
      bestFailureReason: edges.length === 0 ? "" : "no Vertex Cover HC propagation metadata"
    };
  }

  const meta = graph.vertexCoverPropagation;
  meta.coverLimit = coverLimit;
  meta.vertexCount = vertexCount;
  const graphEdgeList = graph.allowedEdges || buildNonzeroEdgeList(graph.edge, graph.n);
  attachEdgeListAdjacency(graphEdgeList, graph.n);
  const vcDecisionCandidates = buildVertexCoverDecisionCandidates(graph, vertexCount);
  const baseMoments = computeTheoryMomentsFromEdgeList(graphEdgeList, graph.n);
  const beta = 1.0 / Math.sqrt(Math.max(Number.MIN_VALUE, baseMoments.tourVariance));
  const requestedBacktracks = Math.max(0, Math.floor(getHcBacktrackTries()));
  const branchLimit = Math.max(1, requestedBacktracks);
  const searchOptions = {
    forceDegreeTwo: true,
    allowedEdgeKeys: graph.allowedEdgeKeys || null,
    allowedEdges: graph.allowedEdges || null,
    momentEdgeList: graphEdgeList,
    vertexCoverPropagation: meta,
    effectiveBeta: beta,
    adaptiveBeta: true,
    betaMultiplier: 1,
    scoreMethod: "importance",
    vertexCount
  };

  const rootEndpointLink = Array(graph.n + 1).fill(0);
  const rootState = {
    closedChains: 0,
    usedVertices: 0,
    chosenEdgeTotal: 0,
    chosenEdges: [],
    allowedEdgeKeys: graph.allowedEdgeKeys,
    allowedEdges: graph.allowedEdges
  };
  const initialForced = propagateConfiguredForcedEdges(graph.edge, graph.n, rootEndpointLink, rootState, searchOptions);
  const capacity = forceVertexCoverCapacityConsequences(vertexCount, meta, graph.edge, rootEndpointLink, rootState);
  if (!rootState.invalid && (capacity.forcedDecisions > 0 || capacity.forcedEdgeCount > 0)) {
    propagateConfiguredForcedEdges(graph.edge, graph.n, rootEndpointLink, rootState, searchOptions);
  }

  const rootConflict = rootState.invalid;
  const queue = [{
    endpointLink: rootEndpointLink,
    state: rootState,
    decisions: [],
    penalty: 0,
    lastAdaptiveBeta: beta
  }];
  const seenQueued = new Set([vertexCoverDecisionSignature(rootState, vertexCount)]);
  const covers = [];
  const seenCovers = new Set();
  let explored = 0;
  let queued = 1;
  let assignmentsChecked = 0;
  let bestFailureReason = rootConflict ? (rootState.invalidReason || "initial Vertex Cover propagation conflict") : "";

  while (!rootConflict && queue.length > 0 && explored < branchLimit) {
    queue.sort((a, b) => a.penalty - b.penalty);
    const branch = queue.shift();
    explored += 1;

    while (!branch.state.invalid) {
      if (!vertexCoverPartialWitnessValid(branch.state, coverLimit, edges)) {
        bestFailureReason = "partial Vertex Cover witness is already impossible";
        break;
      }

      const currentCover = currentVertexCoverWitnessCover(branch.state, vertexCount, coverLimit, edges);
      if (currentCover) {
        assignmentsChecked += 1;
        const signature = currentCover.join(":");
        if (!seenCovers.has(signature)) {
          seenCovers.add(signature);
          covers.push({
            cover: currentCover,
            decisions: branch.decisions.slice(),
            chosenEdges: branch.state.chosenEdges ? branch.state.chosenEdges.slice() : []
          });
        }
        break;
      }

      const targetWitnessCover = vertexCoverRejectedTargetWitnessCover(branch.state, meta, vertexCount, coverLimit, edges);
      if (targetWitnessCover) {
        assignmentsChecked += 1;
        const signature = targetWitnessCover.join(":");
        if (!seenCovers.has(signature)) {
          seenCovers.add(signature);
          covers.push({
            cover: targetWitnessCover,
            decisions: branch.decisions.slice(),
            chosenEdges: branch.state.chosenEdges ? branch.state.chosenEdges.slice() : []
          });
        }
        break;
      }

      const remainingDecisions = currentVertexCoverDecisionCandidateEdges(vcDecisionCandidates, branch.state, graph, branch.endpointLink, coverLimit);
      if (remainingDecisions.length === 0) {
        assignmentsChecked += 1;
        if (vertexCoverWitnessValid(branch.state, vertexCount, coverLimit, edges)) {
          const cover = sortedVertexCoverSet(branch.state, vertexCount);
          const signature = cover.join(":");
          if (!seenCovers.has(signature)) {
            seenCovers.add(signature);
            covers.push({
              cover,
              decisions: branch.decisions.slice(),
              chosenEdges: branch.state.chosenEdges ? branch.state.chosenEdges.slice() : []
            });
          }
        } else {
          bestFailureReason = "completed Vertex Cover witness choices did not cover every edge";
        }
        break;
      }

      const betaInfo = resolveStepBeta(graph.n, graph.edge, null, branch.endpointLink, branch.state, searchOptions, branch.lastAdaptiveBeta);
      branch.lastAdaptiveBeta = betaInfo.lastAdaptiveBeta;
      const scoringOptions = {
        ...searchOptions,
        currentStats: betaInfo.currentStats,
        candidateEdgeList: remainingDecisions
      };
      const currentDecisionByKey = new Map(remainingDecisions.map(candidate => [candidate.key, candidate]));
      const ranked = rankScoringEdges(graph.n, graph.edge, null, branch.endpointLink, branch.state, betaInfo.beta, null, scoringOptions)
        .map(candidate => ({ ...candidate, vcDecision: currentDecisionByKey.get(edgeKey(candidate.from, candidate.to)) }))
        .filter(candidate => candidate.vcDecision);

      const viableRanked = [];
      for (const candidate of ranked) {
        candidate.vcCoverageGain = vertexCoverDecisionCoverageGain(candidate.vcDecision, branch.state, edges, meta, coverLimit);
        if (candidate.vcCoverageGain < 0) continue;
        candidate.vcAddedSelected = vertexCoverDecisionAddedSelectedCount(candidate.vcDecision, branch.state, meta);
        candidate.vcCoverageEfficiency = candidate.vcCoverageGain / Math.max(1, candidate.vcAddedSelected);
        viableRanked.push(candidate);
      }
      ranked.length = 0;
      ranked.push(...viableRanked);
      ranked.sort((a, b) =>
        b.vcCoverageEfficiency - a.vcCoverageEfficiency ||
        b.vcCoverageGain - a.vcCoverageGain ||
        b.probability - a.probability);
      if (ranked.length === 0) {
        bestFailureReason = "no remaining Vertex Cover witness decision edge could be scored";
        break;
      }

      const branchBeforeDecision = cloneVertexCoverDecisionBranch(branch);
      let appliedChoice = null;
      let failedChoiceReason = "";
      for (let optionIndex = 0; optionIndex < ranked.length; optionIndex++) {
        const candidate = ranked[optionIndex];
        const attempt = cloneVertexCoverDecisionBranch(branchBeforeDecision);
        const applied =
          applyVertexCoverDecisionCandidate(attempt, candidate.vcDecision, graph, searchOptions) &&
          vertexCoverPartialWitnessValid(attempt.state, coverLimit, edges);
        if (!applied) {
          failedChoiceReason = attempt.state.invalidReason || "Vertex Cover witness choice became invalid";
          continue;
        }
        branch.endpointLink = attempt.endpointLink;
        branch.state = attempt.state;
        branch.decisions = attempt.decisions;
        branch.lastAdaptiveBeta = attempt.lastAdaptiveBeta;
        appliedChoice = {
          candidate,
          optionIndex,
          signature: vertexCoverDecisionSignature(branch.state, vertexCount)
        };
        break;
      }

      if (!appliedChoice) {
        bestFailureReason = failedChoiceReason || "no remaining Vertex Cover witness decision could be applied";
        break;
      }

      const hasBacktrackRoom = explored + queue.length < branchLimit;
      if (hasBacktrackRoom) {
        const best = appliedChoice.candidate;
        const seenConsequences = new Set([appliedChoice.signature]);
        const alternativesToKeep = shouldStopAtFirstHcTour() ? 2 : ranked.length;
        for (let optionIndex = 0; optionIndex < ranked.length && explored + queue.length < branchLimit; optionIndex++) {
          if (optionIndex === appliedChoice.optionIndex) continue;
          const candidate = ranked[optionIndex];
          const alternative = prepareVertexCoverDecisionAlternative(branchBeforeDecision, { candidate, vcDecision: candidate.vcDecision, best, optionIndex }, graph, searchOptions, edges);
          if (!alternative) continue;
          const signature = vertexCoverDecisionSignature(alternative.state, vertexCount);
          if (seenConsequences.has(signature) || seenQueued.has(signature)) continue;
          seenConsequences.add(signature);
          seenQueued.add(signature);
          queue.push(alternative);
          queued += 1;
          if (seenConsequences.size > alternativesToKeep) break;
        }
      }
    }

    if (covers.length > 0 && shouldStopAtFirstHcTour()) break;
  }

  return {
    hamiltonianFound: covers.length > 0,
    covers,
    explored,
    queued,
    assignmentsChecked,
    requestedBacktracks,
    branchLimit,
    decisionVertices: vertexCount,
    vcDecisionChoices: vcDecisionCandidates.length,
    initialForcedEdges: initialForced.forcedEdgeCount + capacity.forcedEdgeCount,
    totalTourCost: covers.length > 0 ? -graph.n : NaN,
    bestFailureReason
  };
}

function collectVertexCovers(n, k, edges, limit) {
  const chosen = Array(n + 1).fill(false);
  const results = [];
  const seen = new Set();

  function uncoveredEdge() {
    for (const [u, v] of edges) {
      if (!chosen[u] && !chosen[v]) return [u, v];
    }
    return null;
  }

  function collect() {
    const cover = [];
    for (let vertex = 1; vertex <= n; vertex++) if (chosen[vertex]) cover.push(vertex);
    const key = cover.join(":");
    if (seen.has(key)) return;
    seen.add(key);
    results.push(cover);
  }

  function search(count) {
    if (results.length >= limit || count > k) return;
    const edge = uncoveredEdge();
    if (!edge) {
      collect();
      return;
    }

    const [u, v] = edge;
    chosen[u] = true;
    search(count + 1);
    chosen[u] = false;

    chosen[v] = true;
    search(count + 1);
    chosen[v] = false;
  }

  search(0);
  return results;
}

function collectCliques(n, k, edges, limit) {
  if (k === 0) return [[]];
  if (k > n) return [];
  const adjacency = buildAdjacencyMatrix(n, edges);
  const results = [];

  function search(clique, candidates) {
    if (results.length >= limit) return;
    if (clique.length === k) {
      results.push(clique.slice());
      return;
    }
    while (candidates.length > 0 && results.length < limit) {
      if (clique.length + candidates.length < k) return;
      const vertex = candidates.shift();
      const nextCandidates = candidates.filter(candidate => adjacency[vertex][candidate]);
      search([...clique, vertex], nextCandidates);
    }
  }

  search([], Array.from({ length: n }, (_, index) => index + 1));
  return results;
}

function collectIndependentSets(n, k, edges, limit) {
  if (k === 0) return [[]];
  if (k > n) return [];
  const adjacency = buildAdjacencyMatrix(n, edges);
  const results = [];

  function search(chosen, start) {
    if (results.length >= limit) return;
    if (chosen.length === k) {
      results.push(chosen.slice());
      return;
    }
    for (let vertex = start; vertex <= n && results.length < limit; vertex++) {
      if (chosen.length + (n - vertex + 1) < k) return;
      let canUse = true;
      for (const other of chosen) {
        if (adjacency[vertex][other]) {
          canUse = false;
          break;
        }
      }
      if (!canUse) continue;
      chosen.push(vertex);
      search(chosen, vertex + 1);
      chosen.pop();
    }
  }

  search([], 1);
  return results;
}

function collectSetCovers(universeSize, k, sets, limit) {
  const covered = Array(universeSize + 1).fill(false);
  const chosen = [];
  const results = [];
  const seen = new Set();

  function firstUncoveredElement() {
    for (let element = 1; element <= universeSize; element++) {
      if (!covered[element]) return element;
    }
    return 0;
  }

  function collect() {
    const cover = chosen.slice().sort((a, b) => a - b);
    const key = cover.join(":");
    if (seen.has(key)) return;
    seen.add(key);
    results.push(cover);
  }

  function search() {
    if (results.length >= limit) return;
    const element = firstUncoveredElement();
    if (element === 0) {
      collect();
      return;
    }
    if (chosen.length >= k) return;

    for (let setIndex = 0; setIndex < sets.length && results.length < limit; setIndex++) {
      if (!sets[setIndex].includes(element) || chosen.includes(setIndex + 1)) continue;
      const newlyCovered = [];
      for (const value of sets[setIndex]) {
        if (!covered[value]) {
          covered[value] = true;
          newlyCovered.push(value);
        }
      }
      chosen.push(setIndex + 1);
      search();
      chosen.pop();
      for (const value of newlyCovered) covered[value] = false;
    }
  }

  search();
  return results;
}

function collectX3cCovers(universeSize, sets, limit) {
  if (universeSize % 3 !== 0) return [];
  const targetSetCount = universeSize / 3;
  const covered = Array(universeSize + 1).fill(false);
  const chosen = [];
  const results = [];

  function firstUncoveredElement() {
    for (let element = 1; element <= universeSize; element++) {
      if (!covered[element]) return element;
    }
    return 0;
  }

  function search() {
    if (results.length >= limit) return;
    const element = firstUncoveredElement();
    if (element === 0) {
      if (chosen.length === targetSetCount) results.push(chosen.slice());
      return;
    }
    if (chosen.length >= targetSetCount) return;

    for (let setIndex = 0; setIndex < sets.length && results.length < limit; setIndex++) {
      if (!sets[setIndex].includes(element) || chosen.includes(setIndex + 1)) continue;
      let canUse = true;
      for (const value of sets[setIndex]) {
        if (covered[value]) {
          canUse = false;
          break;
        }
      }
      if (!canUse) continue;

      for (const value of sets[setIndex]) covered[value] = true;
      chosen.push(setIndex + 1);
      search();
      chosen.pop();
      for (const value of sets[setIndex]) covered[value] = false;
    }
  }

  search();
  return results;
}

function collectGraphColorings(n, colorCount, edges, limit) {
  const adjacency = Array.from({ length: n + 1 }, () => []);
  for (const [u, v] of edges) {
    adjacency[u].push(v);
    adjacency[v].push(u);
  }
  const order = Array.from({ length: n }, (_, index) => index + 1)
    .sort((a, b) => adjacency[b].length - adjacency[a].length);
  const color = Array(n + 1).fill(0);
  const results = [];

  function canUse(vertex, candidateColor) {
    for (const neighbor of adjacency[vertex]) {
      if (color[neighbor] === candidateColor) return false;
    }
    return true;
  }

  function search(position) {
    if (results.length >= limit) return;
    if (position === order.length) {
      results.push(color.slice());
      return;
    }
    const vertex = order[position];
    for (let candidateColor = 1; candidateColor <= colorCount && results.length < limit; candidateColor++) {
      if (!canUse(vertex, candidateColor)) continue;
      color[vertex] = candidateColor;
      search(position + 1);
      color[vertex] = 0;
    }
  }

  search(0);
  return results;
}

function formatSet(values) {
  if (!values || values.length === 0) return "{}";
  return `{${values.join(",")}}`;
}

function formatSatAssignmentWitness(assignment, variableCount) {
  const values = [];
  for (let variable = 1; variable <= variableCount; variable++) {
    values.push(`x${variable}=${assignment[variable] === 1 ? "true" : "false"}`);
  }
  return values.join(", ");
}

function formatSetCoverWitness(chosenSets, sets) {
  if (!chosenSets || chosenSets.length === 0) return "selected sets = {}";
  return chosenSets
    .map(index => `S${index}={${sets[index - 1].join(",")}}`)
    .join("; ");
}

function formatGraphColoringWitness(color, n) {
  const values = [];
  for (let vertex = 1; vertex <= n; vertex++) {
    values.push(`${vertex}:${graphColorName(color[vertex])}`);
  }
  return values.join(", ");
}

function selectedTrueVariables(assignment, count) {
  const selected = [];
  for (let variable = 1; variable <= count; variable++) {
    if (assignment[variable] === 1) selected.push(variable);
  }
  return selected;
}

function setCoverAssignmentValid(assignment, universeSize, k, sets) {
  const chosen = selectedTrueVariables(assignment, sets.length);
  if (chosen.length > k) return false;
  const covered = Array(universeSize + 1).fill(false);
  for (const setIndex of chosen) {
    for (const element of sets[setIndex - 1]) covered[element] = true;
  }
  for (let element = 1; element <= universeSize; element++) {
    if (!covered[element]) return false;
  }
  return true;
}

function x3cAssignmentValid(assignment, universeSize, sets) {
  if (universeSize % 3 !== 0) return false;
  const chosen = selectedTrueVariables(assignment, sets.length);
  if (chosen.length !== universeSize / 3) return false;
  const coveredCount = Array(universeSize + 1).fill(0);
  for (const setIndex of chosen) {
    for (const element of sets[setIndex - 1]) coveredCount[element] += 1;
  }
  for (let element = 1; element <= universeSize; element++) {
    if (coveredCount[element] !== 1) return false;
  }
  return true;
}

function graphColorFromAssignment(assignment, n, colorCount) {
  const color = Array(n + 1).fill(0);
  for (let vertex = 1; vertex <= n; vertex++) {
    let selected = 0;
    for (let candidateColor = 1; candidateColor <= colorCount; candidateColor++) {
      const variable = colorCount * (vertex - 1) + candidateColor;
      if (assignment[variable] !== 1) continue;
      if (selected !== 0) return null;
      selected = candidateColor;
    }
    if (selected === 0) return null;
    color[vertex] = selected;
  }
  return color;
}

function graphColorAssignmentValid(assignment, n, colorCount, edges) {
  const color = graphColorFromAssignment(assignment, n, colorCount);
  if (!color) return false;
  for (const [u, v] of edges) {
    if (color[u] === color[v]) return false;
  }
  return true;
}

function sudokuGridFromAssignment(assignment, puzzle) {
  const { n } = puzzle;
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      let selected = 0;
      for (let digit = 1; digit <= n; digit++) {
        const variable = ((row * n + col) * n) + digit;
        if (assignment[variable] !== 1) continue;
        if (selected !== 0) return null;
        selected = digit;
      }
      if (selected === 0) return null;
      grid[row][col] = selected;
    }
  }
  return grid;
}

function sudokuAssignmentValid(assignment, puzzle) {
  const { n, boxSize } = puzzle;
  const grid = sudokuGridFromAssignment(assignment, puzzle);
  if (!grid) return false;
  const targetMask = (1n << BigInt(n)) - 1n;
  const seenMask = values => {
    let mask = 0n;
    for (const value of values) {
      if (value < 1 || value > n) return -1n;
      const bit = 1n << BigInt(value - 1);
      if ((mask & bit) !== 0n) return -1n;
      mask |= bit;
    }
    return mask;
  };
  for (let row = 0; row < n; row++) {
    if (seenMask(grid[row]) !== targetMask) return false;
  }
  for (let col = 0; col < n; col++) {
    const values = [];
    for (let row = 0; row < n; row++) values.push(grid[row][col]);
    if (seenMask(values) !== targetMask) return false;
  }
  for (let boxRow = 0; boxRow < n; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < n; boxCol += boxSize) {
      const values = [];
      for (let row = boxRow; row < boxRow + boxSize; row++) {
        for (let col = boxCol; col < boxCol + boxSize; col++) values.push(grid[row][col]);
      }
      if (seenMask(values) !== targetMask) return false;
    }
  }
  return true;
}

function packingAssignmentValid(assignment, candidates) {
  const selected = selectedTrueVariables(assignment, candidates.length).map(index => candidates[index - 1]);
  if (selected.length === 0 && candidates.length > 0) return false;
  const byItem = new Map();
  for (const candidate of candidates) {
    if (!byItem.has(candidate.itemId)) byItem.set(candidate.itemId, 0);
  }
  for (const candidate of selected) {
    byItem.set(candidate.itemId, (byItem.get(candidate.itemId) || 0) + 1);
  }
  for (const count of byItem.values()) {
    if (count !== 1) return false;
  }
  for (let left = 0; left < selected.length; left++) {
    for (let right = left + 1; right < selected.length; right++) {
      if (selected[left].itemId !== selected[right].itemId && packingBoxesOverlap(selected[left], selected[right])) return false;
    }
  }
  return true;
}

function appendWitnessFromSatSearch(lines, search, witnessBuilder) {
  if (!witnessBuilder || !search || !search.hamiltonianFound) return;
  const witnessLines = witnessBuilder(search) || [];
  if (witnessLines.length === 0) return;
  append(lines);
  append(lines, "Witnesses inferred from HC:");
  witnessLines.forEach(line => append(lines, line));
}

function appendWitnessFromHc(lines, hc, witnessBuilder) {
  if (!witnessBuilder || !hc || !hc.hamiltonianFound) return;
  const witnessLines = witnessBuilder(hc) || [];
  if (witnessLines.length === 0) return;
  append(lines);
  append(lines, "Witnesses inferred from HC:");
  witnessLines.forEach(line => append(lines, line));
}

function vertexCoverTo3Sat(n, k, edges) {
  let variableCount = n;
  const clauses = [];
  let rawClauseCount = 0;

  function addClauseAs3Sat(literals) {
    rawClauseCount += 1;
    if (literals.length === 1) {
      clauses.push([literals[0], literals[0], literals[0]]);
      return;
    }
    if (literals.length === 2) {
      clauses.push([literals[0], literals[1], literals[1]]);
      return;
    }
    if (literals.length === 3) {
      clauses.push([literals[0], literals[1], literals[2]]);
      return;
    }

    let previousAux = ++variableCount;
    clauses.push([literals[0], literals[1], previousAux]);
    for (let index = 2; index < literals.length - 2; index++) {
      const nextAux = ++variableCount;
      clauses.push([-previousAux, literals[index], nextAux]);
      previousAux = nextAux;
    }
    clauses.push([-previousAux, literals[literals.length - 2], literals[literals.length - 1]]);
  }

  for (const [u, v] of edges) {
    addClauseAs3Sat([u, v]);
  }

  if (k === 0) {
    for (let vertex = 1; vertex <= n; vertex++) {
      addClauseAs3Sat([-vertex]);
    }
  } else if (k < n) {
    const counter = Array.from({ length: n + 1 }, () => Array(k + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= k; j++) {
        counter[i][j] = ++variableCount;
      }
    }

    addClauseAs3Sat([-1, counter[1][1]]);
    for (let j = 2; j <= k; j++) {
      addClauseAs3Sat([-counter[1][j]]);
    }

    for (let i = 2; i <= n; i++) {
      addClauseAs3Sat([-i, counter[i][1]]);
      addClauseAs3Sat([-counter[i - 1][1], counter[i][1]]);

      for (let j = 2; j <= k; j++) {
        addClauseAs3Sat([-counter[i - 1][j], counter[i][j]]);
        addClauseAs3Sat([-i, -counter[i - 1][j - 1], counter[i][j]]);
      }

      addClauseAs3Sat([-i, -counter[i - 1][k]]);
    }
  }

  return { variableCount, clauses, rawClauseCount, encoding: "sequential counter at-most-k" };
}

function setCoverTo3Sat(universeSize, setCount, k, sets) {
  let variableCount = setCount;
  const clauses = [];
  let rawClauseCount = 0;

  function addClauseAs3Sat(literals) {
    rawClauseCount += 1;
    if (literals.length === 1) {
      clauses.push([literals[0], literals[0], literals[0]]);
      return;
    }
    if (literals.length === 2) {
      clauses.push([literals[0], literals[1], literals[1]]);
      return;
    }
    if (literals.length === 3) {
      clauses.push([literals[0], literals[1], literals[2]]);
      return;
    }

    let previousAux = ++variableCount;
    clauses.push([literals[0], literals[1], previousAux]);
    for (let index = 2; index < literals.length - 2; index++) {
      const nextAux = ++variableCount;
      clauses.push([-previousAux, literals[index], nextAux]);
      previousAux = nextAux;
    }
    clauses.push([-previousAux, literals[literals.length - 2], literals[literals.length - 1]]);
  }

  for (let element = 1; element <= universeSize; element++) {
    const coveringSets = [];
    for (let setIndex = 0; setIndex < setCount; setIndex++) {
      if (sets[setIndex].includes(element)) coveringSets.push(setIndex + 1);
    }
    if (coveringSets.length === 0) {
      const impossible = ++variableCount;
      addClauseAs3Sat([impossible]);
      addClauseAs3Sat([-impossible]);
    } else {
      addClauseAs3Sat(coveringSets);
    }
  }

  if (k === 0) {
    for (let setIndex = 1; setIndex <= setCount; setIndex++) {
      addClauseAs3Sat([-setIndex]);
    }
  } else if (k < setCount) {
    const counter = Array.from({ length: setCount + 1 }, () => Array(k + 1).fill(0));
    for (let i = 1; i <= setCount; i++) {
      for (let j = 1; j <= k; j++) {
        counter[i][j] = ++variableCount;
      }
    }

    addClauseAs3Sat([-1, counter[1][1]]);
    for (let j = 2; j <= k; j++) {
      addClauseAs3Sat([-counter[1][j]]);
    }

    for (let i = 2; i <= setCount; i++) {
      addClauseAs3Sat([-i, counter[i][1]]);
      addClauseAs3Sat([-counter[i - 1][1], counter[i][1]]);

      for (let j = 2; j <= k; j++) {
        addClauseAs3Sat([-counter[i - 1][j], counter[i][j]]);
        addClauseAs3Sat([-i, -counter[i - 1][j - 1], counter[i][j]]);
      }

      addClauseAs3Sat([-i, -counter[i - 1][k]]);
    }
  }

  return { variableCount, clauses, rawClauseCount, encoding: "coverage clauses plus sequential counter at-most-k" };
}

function x3cTo3Sat(universeSize, setCount, sets) {
  let variableCount = setCount;
  const clauses = [];
  let rawClauseCount = 0;

  function addClauseAs3Sat(literals) {
    rawClauseCount += 1;
    if (literals.length === 1) {
      clauses.push([literals[0], literals[0], literals[0]]);
      return;
    }
    if (literals.length === 2) {
      clauses.push([literals[0], literals[1], literals[1]]);
      return;
    }
    if (literals.length === 3) {
      clauses.push([literals[0], literals[1], literals[2]]);
      return;
    }

    let previousAux = ++variableCount;
    clauses.push([literals[0], literals[1], previousAux]);
    for (let index = 2; index < literals.length - 2; index++) {
      const nextAux = ++variableCount;
      clauses.push([-previousAux, literals[index], nextAux]);
      previousAux = nextAux;
    }
    clauses.push([-previousAux, literals[literals.length - 2], literals[literals.length - 1]]);
  }

  for (let element = 1; element <= universeSize; element++) {
    const coveringSets = [];
    for (let setIndex = 0; setIndex < setCount; setIndex++) {
      if (sets[setIndex].includes(element)) coveringSets.push(setIndex + 1);
    }

    if (coveringSets.length === 0) {
      const impossible = ++variableCount;
      addClauseAs3Sat([impossible]);
      addClauseAs3Sat([-impossible]);
      continue;
    }

    addClauseAs3Sat(coveringSets);
    for (let left = 0; left < coveringSets.length; left++) {
      for (let right = left + 1; right < coveringSets.length; right++) {
        addClauseAs3Sat([-coveringSets[left], -coveringSets[right]]);
      }
    }
  }

  if (universeSize % 3 !== 0) {
    const impossible = ++variableCount;
    addClauseAs3Sat([impossible]);
    addClauseAs3Sat([-impossible]);
  }

  return { variableCount, clauses, rawClauseCount, encoding: "exactly-once coverage clauses" };
}

function graphColoringTo3Sat(n, colorCount, edges) {
  let variableCount = colorCount * n;
  const clauses = [];
  let rawClauseCount = 0;
  const colorVar = (vertex, color) => colorCount * (vertex - 1) + color;

  function addClauseAs3Sat(literals) {
    rawClauseCount += 1;
    if (literals.length === 1) {
      clauses.push([literals[0], literals[0], literals[0]]);
      return;
    }
    if (literals.length === 2) {
      clauses.push([literals[0], literals[1], literals[1]]);
      return;
    }
    if (literals.length === 3) {
      clauses.push(literals);
      return;
    }

    let previousAux = ++variableCount;
    clauses.push([literals[0], literals[1], previousAux]);
    for (let index = 2; index < literals.length - 2; index++) {
      const nextAux = ++variableCount;
      clauses.push([-previousAux, literals[index], nextAux]);
      previousAux = nextAux;
    }
    clauses.push([-previousAux, literals[literals.length - 2], literals[literals.length - 1]]);
  }

  for (let vertex = 1; vertex <= n; vertex++) {
    const colorChoices = [];
    for (let color = 1; color <= colorCount; color++) {
      colorChoices.push(colorVar(vertex, color));
    }
    addClauseAs3Sat(colorChoices);
    for (let left = 1; left <= colorCount; left++) {
      for (let right = left + 1; right <= colorCount; right++) {
        addClauseAs3Sat([-colorVar(vertex, left), -colorVar(vertex, right)]);
      }
    }
  }

  for (const [u, v] of edges) {
    for (let color = 1; color <= colorCount; color++) {
      addClauseAs3Sat([-colorVar(u, color), -colorVar(v, color)]);
    }
  }

  return { variableCount, clauses, rawClauseCount, encoding: "one-of-k vertex colors plus edge color conflicts" };
}

function sudokuSymbols(n) {
  return Array.from({ length: n }, (_, index) => String(index + 1));
}

function readSudokuBoxSize() {
  const size = Math.floor(readPositiveNumber("sudokuBoxSize", "Sudoku box size"));
  if (size > 5) throw new Error("The visual Sudoku grid currently supports box sizes up to 5x5.");
  return size;
}

function sudokuBoxIndex(row, col, n, boxSize) {
  return Math.floor(row / boxSize) * boxSize + Math.floor(col / boxSize);
}

function buildSudokuGrid() {
  const boxSize = readSudokuBoxSize();
  const n = boxSize * boxSize;
  const grid = document.getElementById("sudokuGrid");
  grid.innerHTML = "";
  grid.style.setProperty("--sudoku-size", n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const input = document.createElement("input");
      input.className = "sudokuCell";
      input.maxLength = String(n).length;
      input.dataset.row = row;
      input.dataset.col = col;
      input.setAttribute("aria-label", `row ${row + 1} column ${col + 1}`);
      if ((col + 1) % boxSize === 0 && col + 1 < n) input.style.borderRightWidth = "3px";
      if ((row + 1) % boxSize === 0 && row + 1 < n) input.style.borderBottomWidth = "3px";
      input.addEventListener("input", () => {
        input.value = input.value.replace(/[^\d]/g, "").slice(0, String(n).length);
        input.classList.toggle("given", input.value.trim() !== "");
        input.classList.remove("solved");
      });
      grid.appendChild(input);
    }
  }
}

function clearSudokuGrid() {
  document.querySelectorAll("#sudokuGrid .sudokuCell").forEach(cell => {
    cell.value = "";
    cell.classList.remove("given", "solved");
  });
}

function loadSudokuExample() {
  document.getElementById("sudokuBoxSize").value = 3;
  buildSudokuGrid();
  const rows = [
    "53..7....",
    "6..195...",
    ".98....6.",
    "8...6...3",
    "4..8.3..1",
    "7...2...6",
    ".6....28.",
    "...419..5",
    "....8..79"
  ];
  const cells = document.querySelectorAll("#sudokuGrid .sudokuCell");
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const value = line[col] === "." ? "" : line[col];
      const cell = cells[row * 9 + col];
      cell.value = value;
      cell.classList.toggle("given", value !== "");
    }
  });
}

function readSudokuPuzzle() {
  const boxSize = readSudokuBoxSize();
  const n = boxSize * boxSize;
  const symbols = sudokuSymbols(n);
  const symbolToDigit = new Map();
  for (let i = 0; i < symbols.length; i++) symbolToDigit.set(symbols[i], i + 1);
  const cells = Array.from(document.querySelectorAll("#sudokuGrid .sudokuCell"));
  if (cells.length !== n * n) buildSudokuGrid();
  const freshCells = Array.from(document.querySelectorAll("#sudokuGrid .sudokuCell"));
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  let givens = 0;
  for (const cell of freshCells) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const text = cell.value.trim().toUpperCase();
    if (!text || text === ".") continue;
    if (!symbolToDigit.has(text)) throw new Error(`Invalid Sudoku symbol "${text}" for size ${n}. Use numbers 1 through ${n}.`);
    grid[row][col] = symbolToDigit.get(text);
    givens += 1;
  }
  return { n, boxSize, symbols, grid, givens };
}

function cloneSudokuGrid(grid) {
  return grid.map(row => row.slice());
}

function solveSudokuPuzzle(puzzle) {
  const { n, boxSize } = puzzle;
  const fullMask = (1n << BigInt(n)) - 1n;
  const rowMask = Array(n).fill(0n);
  const colMask = Array(n).fill(0n);
  const boxMask = Array(n).fill(0n);
  const grid = cloneSudokuGrid(puzzle.grid);

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const digit = grid[row][col];
      if (digit === 0) continue;
      const bit = 1n << BigInt(digit - 1);
      const box = sudokuBoxIndex(row, col, n, boxSize);
      if ((rowMask[row] & bit) || (colMask[col] & bit) || (boxMask[box] & bit)) return null;
      rowMask[row] |= bit;
      colMask[col] |= bit;
      boxMask[box] |= bit;
    }
  }

  function search() {
    let bestRow = -1;
    let bestCol = -1;
    let bestMask = 0n;
    let bestCount = n + 1;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (grid[row][col] !== 0) continue;
        const box = sudokuBoxIndex(row, col, n, boxSize);
        const mask = fullMask & ~(rowMask[row] | colMask[col] | boxMask[box]);
        const count = mask.toString(2).replace(/0/g, "").length;
        if (count === 0) return false;
        if (count < bestCount) {
          bestCount = count;
          bestRow = row;
          bestCol = col;
          bestMask = mask;
          if (count === 1) break;
        }
      }
      if (bestCount === 1) break;
    }
    if (bestRow === -1) return true;
    const box = sudokuBoxIndex(bestRow, bestCol, n, boxSize);
    for (let digit = 1; digit <= n; digit++) {
      const bit = 1n << BigInt(digit - 1);
      if ((bestMask & bit) === 0n) continue;
      grid[bestRow][bestCol] = digit;
      rowMask[bestRow] |= bit;
      colMask[bestCol] |= bit;
      boxMask[box] |= bit;
      if (search()) return true;
      grid[bestRow][bestCol] = 0;
      rowMask[bestRow] &= ~bit;
      colMask[bestCol] &= ~bit;
      boxMask[box] &= ~bit;
    }
    return false;
  }

  return search() ? grid : null;
}

function applySudokuSolution(puzzle, solution) {
  const cells = document.querySelectorAll("#sudokuGrid .sudokuCell");
  cells.forEach(cell => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (solution) {
      cell.value = puzzle.symbols[solution[row][col] - 1];
      if (puzzle.grid[row][col] === 0) cell.classList.add("solved");
    }
    cell.classList.toggle("given", puzzle.grid[row][col] !== 0);
  });
}

function formatSudokuGrid(grid, symbols) {
  return grid.map(row => row.map(value => value ? symbols[value - 1] : ".").join(" ")).join("\n");
}

function sudokuTo3Sat(puzzle) {
  const { n, boxSize, grid } = puzzle;
  let variableCount = n * n * n;
  const clauses = [];
  let rawClauseCount = 0;
  const placementVar = (row, col, digit) => ((row * n + col) * n) + digit;

  function addClauseAs3Sat(literals) {
    rawClauseCount += 1;
    if (literals.length === 1) {
      clauses.push([literals[0], literals[0], literals[0]]);
      return;
    }
    if (literals.length === 2) {
      clauses.push([literals[0], literals[1], literals[1]]);
      return;
    }
    if (literals.length === 3) {
      clauses.push(literals);
      return;
    }
    let previousAux = ++variableCount;
    clauses.push([literals[0], literals[1], previousAux]);
    for (let index = 2; index < literals.length - 2; index++) {
      const nextAux = ++variableCount;
      clauses.push([-previousAux, literals[index], nextAux]);
      previousAux = nextAux;
    }
    clauses.push([-previousAux, literals[literals.length - 2], literals[literals.length - 1]]);
  }

  function addExactlyOne(literals) {
    addClauseAs3Sat(literals);
    for (let left = 0; left < literals.length; left++) {
      for (let right = left + 1; right < literals.length; right++) {
        addClauseAs3Sat([-literals[left], -literals[right]]);
      }
    }
  }

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const choices = [];
      for (let digit = 1; digit <= n; digit++) choices.push(placementVar(row, col, digit));
      addExactlyOne(choices);
    }
  }
  for (let row = 0; row < n; row++) {
    for (let digit = 1; digit <= n; digit++) {
      const choices = [];
      for (let col = 0; col < n; col++) choices.push(placementVar(row, col, digit));
      addExactlyOne(choices);
    }
  }
  for (let col = 0; col < n; col++) {
    for (let digit = 1; digit <= n; digit++) {
      const choices = [];
      for (let row = 0; row < n; row++) choices.push(placementVar(row, col, digit));
      addExactlyOne(choices);
    }
  }
  for (let boxRow = 0; boxRow < n; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < n; boxCol += boxSize) {
      for (let digit = 1; digit <= n; digit++) {
        const choices = [];
        for (let row = boxRow; row < boxRow + boxSize; row++) {
          for (let col = boxCol; col < boxCol + boxSize; col++) {
            choices.push(placementVar(row, col, digit));
          }
        }
        addExactlyOne(choices);
      }
    }
  }
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (grid[row][col] !== 0) addClauseAs3Sat([placementVar(row, col, grid[row][col])]);
    }
  }

  return { variableCount, baseVariableCount: n * n * n, clauses, rawClauseCount, encoding: "Sudoku exact cover constraints" };
}

function summarizeLargeSudokuReduction(puzzle) {
  const { n, boxSize, grid } = puzzle;
  const baseVariableCount = n * n * n;
  const occurrenceCount = [0];
  for (let variable = 1; variable <= baseVariableCount; variable++) occurrenceCount[variable] = 0;
  let variableCount = baseVariableCount;
  let rawClauseCount = 0;
  let clauseCount = 0;
  const placementVar = (row, col, digit) => ((row * n + col) * n) + digit;

  function addClause(literals) {
    clauseCount += 1;
    for (const literal of literals) occurrenceCount[Math.abs(literal)] += 1;
  }

  function addClauseAs3Sat(literals) {
    rawClauseCount += 1;
    if (literals.length === 1) {
      addClause([literals[0], literals[0], literals[0]]);
      return;
    }
    if (literals.length === 2) {
      addClause([literals[0], literals[1], literals[1]]);
      return;
    }
    if (literals.length === 3) {
      addClause(literals);
      return;
    }
    let previousAux = ++variableCount;
    occurrenceCount[previousAux] = 0;
    addClause([literals[0], literals[1], previousAux]);
    for (let index = 2; index < literals.length - 2; index++) {
      const nextAux = ++variableCount;
      occurrenceCount[nextAux] = 0;
      addClause([-previousAux, literals[index], nextAux]);
      previousAux = nextAux;
    }
    addClause([-previousAux, literals[literals.length - 2], literals[literals.length - 1]]);
  }

  function addExactlyOne(literals) {
    addClauseAs3Sat(literals);
    for (let left = 0; left < literals.length; left++) {
      for (let right = left + 1; right < literals.length; right++) {
        addClauseAs3Sat([-literals[left], -literals[right]]);
      }
    }
  }

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const choices = [];
      for (let digit = 1; digit <= n; digit++) choices.push(placementVar(row, col, digit));
      addExactlyOne(choices);
    }
  }
  for (let row = 0; row < n; row++) {
    for (let digit = 1; digit <= n; digit++) {
      const choices = [];
      for (let col = 0; col < n; col++) choices.push(placementVar(row, col, digit));
      addExactlyOne(choices);
    }
  }
  for (let col = 0; col < n; col++) {
    for (let digit = 1; digit <= n; digit++) {
      const choices = [];
      for (let row = 0; row < n; row++) choices.push(placementVar(row, col, digit));
      addExactlyOne(choices);
    }
  }
  for (let boxRow = 0; boxRow < n; boxRow += boxSize) {
    for (let boxCol = 0; boxCol < n; boxCol += boxSize) {
      for (let digit = 1; digit <= n; digit++) {
        const choices = [];
        for (let row = boxRow; row < boxRow + boxSize; row++) {
          for (let col = boxCol; col < boxCol + boxSize; col++) choices.push(placementVar(row, col, digit));
        }
        addExactlyOne(choices);
      }
    }
  }
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (grid[row][col] !== 0) addClauseAs3Sat([placementVar(row, col, grid[row][col])]);
    }
  }

  let slotCount = 0;
  for (let variable = 1; variable <= variableCount; variable++) {
    slotCount += Math.max(2, occurrenceCount[variable] + 1);
  }
  const baseDirected = slotCount + clauseCount + 2;
  const totalLiteralOccurrences = clauseCount * 3;
  const directedArcs =
    (2 * (slotCount - variableCount)) +
    2 +
    (4 * (variableCount - 1)) +
    2 +
    (2 * totalLiteralOccurrences) +
    1;
  return {
    baseVariableCount,
    variableCount,
    rawClauseCount,
    clauseCount,
    stats: {
      baseDirected,
      directedCount: baseDirected,
      n: 3 * baseDirected,
      arcCount: directedArcs
    }
  };
}

function appendDirectVertexCoverHcReduction(lines, graph, sourceLabel, answerLabel, yesText = "YES", noText = "NO", witnessBuilder = null) {
  const hc = runCompressedHcDecision(graph, sourceLabel);
  const answerLine = inferredAnswerLine(hc, answerLabel, yesText, noText);
  append(lines);
  append(lines, "Final answer:");
  append(lines, answerLine);
  appendWitnessFromHc(lines, hc, witnessBuilder);
  append(lines);
  append(lines, hc.summary);
  return hc;
}

function formatVertexCoverWitnessSearchSummary(search, graph) {
  const lines = [];
  append(lines, "NP-douce HC witness-choice result:");
  append(lines, `HC nodes = ${graph.n}`);
  if (graph.allowedEdgeKeys) append(lines, `allowed HC edges scored = ${graph.allowedEdgeKeys.size}`);
  append(lines, `VC decision vertices checked = ${search.decisionVertices}`);
  append(lines, `VC witness choices scored = ${search.vcDecisionChoices}`);
  append(lines, `VC witness branches explored = ${search.explored}`);
  append(lines, `VC witness branch limit = ${search.branchLimit}`);
  append(lines, `VC assignments checked = ${search.assignmentsChecked}`);
  append(lines, `HC backtrack tries = ${search.requestedBacktracks}`);
  append(lines, `HC tour search mode = ${shouldStopAtFirstHcTour() ? "stop at first HC tour" : "search all tries"}`);
  append(lines, `VC/degree-2 forced edges before choices = ${search.initialForcedEdges}`);
  append(lines, `HC target cost = ${formatNumber(-graph.n)}`);
  if (search.hamiltonianFound) {
    append(lines, "HC decision: HAMILTONIAN CYCLE WITNESS ACCEPTED");
    append(lines, `HC witness decision cost = ${formatNumber(search.totalTourCost)}`);
  } else {
    append(lines, "HC decision: HAMILTONIAN CYCLE WITNESS NOT FOUND");
    if (search.bestFailureReason) append(lines, `best failed reason = ${search.bestFailureReason}`);
  }
  return lines.join("\n");
}

function appendVertexCoverWitnessHcReduction(lines, graph, vertexCount, coverLimit, edges, answerLabel, yesText = "YES", noText = "NO", witnessBuilder = null) {
  const search = runVertexCoverWitnessHcDecisionSearch(graph, vertexCount, coverLimit, edges);
  const summary = formatVertexCoverWitnessSearchSummary(search, graph);
  append(lines);
  append(lines, "Final answer:");
  append(lines, search.hamiltonianFound
    ? `${answerLabel} answer inferred from HC witness choices: ${yesText}`
    : `${answerLabel} answer inferred from HC witness choices: NOT FOUND BY HC WITNESS SEARCH`);
  if (witnessBuilder && search.hamiltonianFound) {
    const witnessLines = witnessBuilder(search) || [];
    if (witnessLines.length > 0) {
      append(lines);
      append(lines, "Witnesses inferred from HC:");
      witnessLines.forEach(line => append(lines, line));
    }
  }
  append(lines);
  append(lines, summary);
  return {
    text: "",
    summary,
    totalTourCost: search.totalTourCost,
    hamiltonianFound: search.hamiltonianFound,
    notComputed: false,
    vcWitnessSearch: search
  };
}

function clauseLiteralsForVertexCoverTriangle(clause) {
  if (clause.length === 1) return [clause[0], clause[0], clause[0]];
  if (clause.length === 2) return [clause[0], clause[1], clause[1]];
  if (clause.length === 3) return clause.slice();
  throw new Error("3-SAT to Vertex Cover expects clauses with one, two, or three literals after normalization.");
}

function estimateSatToVertexCoverReduction(variableCount, clauseCount, padding = 0) {
  const vertexCoverVertices = (2 * variableCount) + (3 * clauseCount);
  const vertexCoverEdges = variableCount + (6 * clauseCount);
  const vertexCoverTarget = variableCount + (2 * clauseCount);
  const selectorSlots = Math.min(vertexCoverTarget, vertexCoverVertices);
  const hcNodes = (12 * vertexCoverEdges) + (2 * selectorSlots) + padding;
  return {
    variableCount,
    clauseCount,
    vertexCoverVertices,
    vertexCoverEdges,
    vertexCoverTarget,
    selectorSlots,
    hcNodes,
    padding
  };
}

function buildSatToVertexCoverInstance(variableCount, clauses, padding = 0) {
  const edges = [];
  const totalVertices = (2 * variableCount) + (3 * clauses.length);
  const satLiteralByVertex = Array(totalVertices + 1).fill(null);
  const add = (u, v) => {
    if (u === v) return;
    edges.push([u, v]);
  };
  const positiveVertex = variable => (2 * variable) - 1;
  const negativeVertex = variable => 2 * variable;
  const literalVertex = literal => literal > 0 ? positiveVertex(literal) : negativeVertex(-literal);

  for (let variable = 1; variable <= variableCount; variable++) {
    satLiteralByVertex[positiveVertex(variable)] = { variable, sign: 1 };
    satLiteralByVertex[negativeVertex(variable)] = { variable, sign: -1 };
    add(positiveVertex(variable), negativeVertex(variable));
  }

  for (let clauseIndex = 0; clauseIndex < clauses.length; clauseIndex++) {
    const literals = clauseLiteralsForVertexCoverTriangle(clauses[clauseIndex]);
    const base = (2 * variableCount) + (3 * clauseIndex) + 1;
    const a = base;
    const b = base + 1;
    const c = base + 2;
    add(a, b);
    add(b, c);
    add(a, c);
    add(a, literalVertex(literals[0]));
    add(b, literalVertex(literals[1]));
    add(c, literalVertex(literals[2]));
  }

  return {
    n: totalVertices,
    k: variableCount + (2 * clauses.length),
    padding,
    edges,
    variableCount,
    clauseCount: clauses.length,
    satLiteralByVertex
  };
}

function prepareSatViaVertexCoverForHc(sat, padding, materializeLimit = getHcSolveNodeLimit()) {
  const simplified = simplify3SatForHc(sat.variableCount, sat.clauses);
  if (simplified.contradiction) {
    return { simplified, vertexCover: null, graph: null, stats: null, skipped: false };
  }

  const stats = estimateSatToVertexCoverReduction(simplified.variableCount, simplified.clauses.length, padding);
  if (stats.hcNodes > materializeLimit) {
    return {
      simplified,
      vertexCover: null,
      graph: null,
      stats,
      skipped: true,
      skipReason: `${stats.hcNodes} HC nodes is above the HC solve node limit ${materializeLimit}`
    };
  }

  const vertexCover = buildSatToVertexCoverInstance(simplified.variableCount, simplified.clauses, padding);
  const graph = buildDirectVertexCoverHcGraph(vertexCover.n, vertexCover.k, vertexCover.edges, padding);
  if (graph.vertexCoverPropagation) {
    graph.vertexCoverPropagation.satLiteralByVertex = vertexCover.satLiteralByVertex;
    graph.vertexCoverPropagation.satVariableCount = vertexCover.variableCount;
    graph.vertexCoverPropagation.satDecisionEdgeKeys = new Set();
    for (const pattern of graph.vertexCoverPropagation.rejectionPatterns) {
      if (!vertexCoverPatternIsSatVariablePair(pattern, graph.vertexCoverPropagation)) continue;
      graph.vertexCoverPropagation.satDecisionEdgeKeys.add(pattern.crossKeys[0]);
    }
  }
  return { simplified, vertexCover, graph, stats, skipped: false };
}

function formatSatWitnessSearchSummary(search, graph) {
  const lines = [];
  append(lines, "NP-douce HC witness-choice result:");
  append(lines, `HC nodes = ${graph.n}`);
  if (graph.allowedEdgeKeys) append(lines, `allowed HC edges scored = ${graph.allowedEdgeKeys.size}`);
  append(lines, `SAT decision variables checked = ${search.decisionVariableCount}`);
  append(lines, `SAT witness choices scored = ${search.satDecisionChoices}`);
  append(lines, `SAT witness branches explored = ${search.explored}`);
  append(lines, `SAT witness branch limit = ${search.branchLimit}`);
  append(lines, `SAT assignments checked = ${search.assignmentsChecked}`);
  append(lines, `HC backtrack tries = ${search.requestedBacktracks}`);
  append(lines, `HC tour search mode = ${shouldStopAtFirstHcTour() ? "stop at first HC tour" : "search all tries"}`);
  append(lines, `VC/degree-2 forced edges before SAT choices = ${search.initialForcedEdges}`);
  append(lines, `HC target cost = ${formatNumber(-graph.n)}`);
  if (search.hamiltonianFound) {
    append(lines, "HC decision: HAMILTONIAN CYCLE WITNESS ACCEPTED");
    append(lines, `HC witness decision cost = ${formatNumber(search.totalTourCost)}`);
  } else {
    append(lines, "HC decision: HAMILTONIAN CYCLE WITNESS NOT FOUND");
    if (search.bestFailureReason) append(lines, `best failed reason = ${search.bestFailureReason}`);
  }
  return lines.join("\n");
}

function appendSatViaVertexCoverHcReduction(lines, prepared, sourceLabel, answerLabel, yesText = "YES", noText = "NO", witnessBuilder = null, searchOptions = {}) {
  if (prepared.simplified.contradiction) {
    append(lines, "Final answer:");
    append(lines, `${answerLabel} answer after exact unit simplification: ${noText}`);
    return { text: "", summary: "", totalTourCost: NaN, hamiltonianFound: false, notComputed: true };
  }

  if (prepared.skipped) {
    append(lines, "Final answer:");
    append(lines, `${answerLabel} answer inferred from HC witness choices: NOT COMPUTED`);
    append(lines);
    append(lines, "Run summary:");
    append(lines, `estimated HC nodes after Vertex Cover gadget = ${prepared.stats.hcNodes}`);
    append(lines, `HC solver not run because ${prepared.skipReason}.`);
    return { text: "", summary: "", totalTourCost: NaN, hamiltonianFound: false, notComputed: true };
  }

  const formulaVariableCount = searchOptions.formulaVariableCount || prepared.simplified.variableCount;
  const formulaClauses = searchOptions.formulaClauses || prepared.simplified.clauses;
  const search = runSatWitnessHcDecisionSearch(prepared, formulaVariableCount, formulaClauses, searchOptions);
  const summary = formatSatWitnessSearchSummary(search, prepared.graph);
  append(lines);
  append(lines, "Final answer:");
  append(lines, search.hamiltonianFound
    ? `${answerLabel} answer inferred from HC witness choices: ${yesText}`
    : `${answerLabel} answer inferred from HC witness choices: NOT FOUND BY HC WITNESS SEARCH`);
  appendWitnessFromSatSearch(lines, search, witnessBuilder);
  append(lines);
  append(lines, summary);
  return {
    text: "",
    summary,
    totalTourCost: search.totalTourCost,
    hamiltonianFound: search.hamiltonianFound,
    notComputed: false,
    satWitnessSearch: search
  };
}

function runVertexCover(text) {
  const { n, k, padding, edges } = parseVertexCover(text);
  const lines = [];
  const reduced = reduceVertexCoverBySafeRules(n, k, edges);

  if (reduced.impossible) {
    append(lines, "Final answer:");
    append(lines, "Vertex Cover answer inferred before HC witness choices: NO");
    append(lines, `reason = ${reduced.impossibleReason}`);
    append(lines);
    append(lines, "Run summary:");
    append(lines, `VC exact precheck forced vertices = ${reduced.forcedCover.length}`);
    append(lines, `VC exact precheck removed isolated vertices = ${reduced.removedIsolated}`);
    append(lines, `VC matching lower bound = ${reduced.matchingLowerBound}`);
    return lines.join("\n");
  }

  const graph = buildDirectVertexCoverHcGraph(reduced.n, reduced.k, reduced.edges, padding);

  appendVertexCoverWitnessHcReduction(lines, graph, reduced.n, reduced.k, reduced.edges, "Vertex Cover", "YES", "NO", search => {
    const limit = witnessDisplayLimit();
    const covers = search.covers.slice(0, limit).map(item => {
      const mapped = item.cover
        .map(vertex => reduced.vertexMap[vertex - 1])
        .filter(vertex => vertex !== undefined);
      return reduced.forcedCover.concat(mapped).sort((a, b) => a - b);
    });
    if (covers.length === 0) return ["vertex cover witness unavailable even though HC returned YES"];
    return [
      `vertex covers shown = ${covers.length} / found ${search.covers.length}`,
      ...covers.map((cover, index) => `${index + 1}. vertex cover = ${formatSet(cover)}; cover size = ${cover.length} / k=${k}`)
    ];
  });
  if (reduced.forcedCover.length > 0 || reduced.removedIsolated > 0 || reduced.n !== n) {
    append(lines, `VC exact precheck forced vertices = ${reduced.forcedCover.length}; removed isolated vertices = ${reduced.removedIsolated}; reduced vertices = ${reduced.n} / original ${n}; remaining k = ${reduced.k}`);
  }
  return lines.join("\n");
}

function runClique(text) {
  const { n, k, padding, edges } = parseClique(text);
  const reduced = reduceCliqueByCore(n, k, edges);
  const complementEdges = buildComplementEdges(reduced.n, reduced.edges);
  const vertexCoverK = reduced.n - k;
  const graph = vertexCoverK >= 0 ? buildDirectVertexCoverHcGraph(reduced.n, vertexCoverK, complementEdges, padding) : null;
  if (graph && graph.vertexCoverPropagation) {
    graph.vertexCoverPropagation.witnessKind = "clique";
    graph.vertexCoverPropagation.witnessTargetSize = k;
    graph.vertexCoverPropagation.witnessOnlyPropagation = true;
  }

  const lines = [];
  if (!graph) {
    append(lines, "Final answer:");
    append(lines, "Clique answer: NO");
    append(lines, reduced.n < k
      ? `Only ${reduced.n} vertices survived the exact k-core clique precheck, fewer than k=${k}.`
      : `k = ${k} is larger than the vertex count ${n}`);
    return lines.join("\n");
  }

  appendVertexCoverWitnessHcReduction(lines, graph, reduced.n, vertexCoverK, complementEdges, "Clique", "YES", "NO", search => {
    const limit = witnessDisplayLimit();
    const activeOriginalVertices = new Set(reduced.vertexMap);
    const prunedCoverVertices = [];
    for (let vertex = 1; vertex <= n; vertex++) {
      if (!activeOriginalVertices.has(vertex)) prunedCoverVertices.push(vertex);
    }
    const cliques = search.covers.slice(0, limit).map(item => {
      const coverSet = new Set(item.cover);
      const clique = [];
      for (let vertex = 1; vertex <= reduced.n; vertex++) {
        if (!coverSet.has(vertex)) clique.push(reduced.vertexMap[vertex - 1]);
      }
      const mappedCover = item.cover
        .map(vertex => reduced.vertexMap[vertex - 1])
        .filter(vertex => vertex !== undefined);
      return {
        clique,
        cover: mappedCover.concat(prunedCoverVertices).sort((a, b) => a - b)
      };
    });
    if (cliques.length === 0) return ["clique witness unavailable even though HC returned YES"];
    return [
      `cliques shown = ${cliques.length} / found ${search.covers.length}`,
      ...cliques.map((item, index) => {
        return `${index + 1}. clique = ${formatSet(item.clique)}; complement vertex cover = ${formatSet(item.cover)}; clique size = ${item.clique.length} / requested k=${k}`;
      })
    ];
  });
  if (reduced.removed > 0) {
    append(lines, `Clique exact precheck removed vertices = ${reduced.removed}; reduced vertices = ${reduced.n} / original ${n}`);
  }
  return lines.join("\n");
}

function runIndependentSet(text) {
  const { n, k, padding, edges } = parseIndependentSet(text);
  const reduced = reduceIndependentSetByCore(n, k, edges);
  const vertexCoverK = reduced.n - k;
  const graph = vertexCoverK >= 0 ? buildDirectVertexCoverHcGraph(reduced.n, vertexCoverK, reduced.edges, padding) : null;
  if (graph && graph.vertexCoverPropagation) {
    graph.vertexCoverPropagation.witnessKind = "independentSet";
    graph.vertexCoverPropagation.witnessTargetSize = k;
    graph.vertexCoverPropagation.witnessOnlyPropagation = true;
  }

  const lines = [];
  if (!graph) {
    append(lines, "Final answer:");
    append(lines, "Independent Set answer: NO");
    append(lines, reduced.n < k
      ? `Only ${reduced.n} vertices survived the exact independent-set core precheck, fewer than k=${k}.`
      : `k = ${k} is larger than the vertex count ${n}`);
    return lines.join("\n");
  }

  appendVertexCoverWitnessHcReduction(lines, graph, reduced.n, vertexCoverK, reduced.edges, "Independent Set", "YES", "NO", search => {
    const limit = witnessDisplayLimit();
    const activeOriginalVertices = new Set(reduced.vertexMap);
    const prunedCoverVertices = [];
    for (let vertex = 1; vertex <= n; vertex++) {
      if (!activeOriginalVertices.has(vertex)) prunedCoverVertices.push(vertex);
    }
    const independentSets = search.covers.slice(0, limit).map(item => {
      const coverSet = new Set(item.cover);
      const independent = [];
      for (let vertex = 1; vertex <= reduced.n; vertex++) {
        if (!coverSet.has(vertex)) independent.push(reduced.vertexMap[vertex - 1]);
      }
      const mappedCover = item.cover
        .map(vertex => reduced.vertexMap[vertex - 1])
        .filter(vertex => vertex !== undefined);
      return {
        independent,
        cover: mappedCover.concat(prunedCoverVertices).sort((a, b) => a - b)
      };
    });
    if (independentSets.length === 0) return ["independent set witness unavailable even though HC returned YES"];
    return [
      `independent sets shown = ${independentSets.length} / found ${search.covers.length}`,
      ...independentSets.map((item, index) => {
        return `${index + 1}. independent set = ${formatSet(item.independent)}; vertex cover = ${formatSet(item.cover)}; independent set size = ${item.independent.length} / requested k=${k}`;
      })
    ];
  });
  if (reduced.removed > 0) {
    append(lines, `Independent Set exact precheck removed vertices = ${reduced.removed}; reduced vertices = ${reduced.n} / original ${n}`);
  }
  return lines.join("\n");
}

function runSetCover(text) {
  const { universeSize, setCount, k, padding, sets } = parseSetCover(text);
  const reduced = reduceSetCoverBySafeRules(universeSize, k, sets);
  const lines = [];

  if (reduced.impossible) {
    append(lines, "Final answer:");
    append(lines, "Set Cover answer inferred before HC witness choices: NO");
    append(lines, `reason = ${reduced.impossibleReason}`);
    append(lines);
    append(lines, "Run summary:");
    append(lines, `Set Cover exact precheck forced sets = ${reduced.forcedSets.length}`);
    append(lines, `Set Cover reduced universe size = ${reduced.universeSize} / original ${universeSize}`);
    return lines.join("\n");
  }

  if (reduced.universeSize === 0) {
    append(lines, "Final answer:");
    append(lines, "Set Cover answer inferred before HC witness choices: YES");
    append(lines);
    append(lines, "Witnesses inferred from exact precheck:");
    append(lines, `1. selected set indices = ${formatSet(reduced.forcedSets)}; ${formatSetCoverWitness(reduced.forcedSets, sets)}; sets selected = ${reduced.forcedSets.length} / k=${k}`);
    append(lines);
    append(lines, "Run summary:");
    append(lines, `Set Cover exact precheck forced sets = ${reduced.forcedSets.length}`);
    append(lines, `Set Cover reduced universe size = 0 / original ${universeSize}`);
    return lines.join("\n");
  }

  if (reduced.setCount === 0) {
    append(lines, "Final answer:");
    append(lines, "Set Cover answer inferred before HC witness choices: NO");
    append(lines, "reason = no remaining set covers an uncovered element");
    return lines.join("\n");
  }

  const sat = setCoverTo3Sat(reduced.universeSize, reduced.setCount, reduced.k, reduced.sets);
  const prepared = prepareSatViaVertexCoverForHc(sat, padding);
  appendSatViaVertexCoverHcReduction(lines, prepared, "Set Cover via 3-SAT -> Vertex Cover -> direct HC", "Set Cover", "YES", "NO", search => {
    const limit = witnessDisplayLimit();
    const covers = search.satisfyingAssignments
      .slice(0, limit)
      .map(item => {
        const selected = selectedTrueVariables(item.decisionAssignment || item.assignment, reduced.setCount)
          .map(index => reduced.setMap[index - 1])
          .filter(index => index !== undefined);
        return reduced.forcedSets.concat(selected).sort((a, b) => a - b);
      });
    if (covers.length === 0) return ["set cover witness unavailable even though HC returned YES"];
    return [
      `set covers shown = ${covers.length} / found ${search.satisfyingAssignments.length}`,
      ...covers.map((cover, index) => `${index + 1}. selected set indices = ${formatSet(cover)}; ${formatSetCoverWitness(cover, sets)}; sets selected = ${cover.length} / k=${k}`)
    ];
  }, {
    formulaVariableCount: sat.variableCount,
    formulaClauses: sat.clauses,
    decisionVariableCount: reduced.setCount,
    assignmentValidator: assignment => setCoverAssignmentValid(assignment, reduced.universeSize, reduced.k, reduced.sets),
    partialAssignmentValidator: assignment => selectedTrueVariables(assignment, reduced.setCount).length <= reduced.k,
    forcedDecisionsAfterChoice: (candidate, assignment) => {
      if (candidate.value !== 1) return [];
      if (selectedTrueVariables(assignment, reduced.setCount).length < reduced.k) return [];
      const forced = [];
      for (let setIndex = 1; setIndex <= reduced.setCount; setIndex++) {
        if (assignment[setIndex] === -1) forced.push({ variable: setIndex, value: 0 });
      }
      return forced;
    }
  });
  if (reduced.forcedSets.length > 0 || reduced.universeSize !== universeSize || reduced.setCount !== setCount) {
    append(lines, `Set Cover exact precheck forced sets = ${reduced.forcedSets.length}; reduced universe size = ${reduced.universeSize} / original ${universeSize}; reduced set count = ${reduced.setCount} / original ${setCount}; remaining k = ${reduced.k}`);
  }
  return lines.join("\n");
}

function runX3c(text) {
  const { universeSize, setCount, padding, sets } = parseX3c(text);
  const reduced = reduceX3cBySafeRules(universeSize, sets);
  const lines = [];
  const targetSetCount = universeSize % 3 === 0 ? universeSize / 3 : "not integral";

  if (reduced.impossible) {
    append(lines, "Final answer:");
    append(lines, "X3C answer inferred before HC witness choices: NO");
    append(lines, `reason = ${reduced.impossibleReason}`);
    append(lines);
    append(lines, "Run summary:");
    append(lines, `X3C exact precheck forced sets = ${reduced.forcedSets.length}`);
    append(lines, `X3C reduced universe size = ${reduced.universeSize} / original ${universeSize}`);
    return lines.join("\n");
  }

  if (reduced.universeSize === 0) {
    append(lines, "Final answer:");
    append(lines, "X3C answer inferred before HC witness choices: YES");
    append(lines);
    append(lines, "Witnesses inferred from exact precheck:");
    append(lines, `1. selected 3-set indices = ${formatSet(reduced.forcedSets)}; ${formatSetCoverWitness(reduced.forcedSets, sets)}; sets selected = ${reduced.forcedSets.length} / target=${targetSetCount}`);
    append(lines);
    append(lines, "Run summary:");
    append(lines, `X3C exact precheck forced sets = ${reduced.forcedSets.length}`);
    append(lines, `X3C reduced universe size = 0 / original ${universeSize}`);
    return lines.join("\n");
  }

  if (reduced.setCount === 0) {
    append(lines, "Final answer:");
    append(lines, "X3C answer inferred before HC witness choices: NO");
    append(lines, "reason = no remaining 3-set covers an uncovered element");
    return lines.join("\n");
  }

  const sat = x3cTo3Sat(reduced.universeSize, reduced.setCount, reduced.sets);
  const prepared = prepareSatViaVertexCoverForHc(sat, padding);
  appendSatViaVertexCoverHcReduction(lines, prepared, "X3C via 3-SAT -> Vertex Cover -> direct HC", "X3C", "YES", "NO", search => {
    const limit = witnessDisplayLimit();
    const exactCovers = search.satisfyingAssignments
      .slice(0, limit)
      .map(item => {
        const selected = selectedTrueVariables(item.decisionAssignment || item.assignment, reduced.setCount)
          .map(index => reduced.setMap[index - 1])
          .filter(index => index !== undefined);
        return reduced.forcedSets.concat(selected).sort((a, b) => a - b);
      });
    if (exactCovers.length === 0) return ["exact cover witness unavailable even though HC returned YES"];
    return [
      `exact covers shown = ${exactCovers.length} / found ${search.satisfyingAssignments.length}`,
      ...exactCovers.map((exactCover, index) => `${index + 1}. selected 3-set indices = ${formatSet(exactCover)}; ${formatSetCoverWitness(exactCover, sets)}; sets selected = ${exactCover.length} / target=${targetSetCount}`)
    ];
  }, {
    formulaVariableCount: sat.variableCount,
    formulaClauses: sat.clauses,
    decisionVariableCount: reduced.setCount,
    assignmentValidator: assignment => x3cAssignmentValid(assignment, reduced.universeSize, reduced.sets),
    partialAssignmentValidator: assignment => reduced.universeSize % 3 === 0 && selectedTrueVariables(assignment, reduced.setCount).length <= reduced.universeSize / 3,
    forcedDecisionsAfterChoice: (candidate, assignment) => {
      if (candidate.value !== 1) return [];
      const chosenSet = reduced.sets[candidate.variable - 1] || [];
      const chosenElements = new Set(chosenSet);
      const forced = [];
      for (let setIndex = 1; setIndex <= reduced.setCount; setIndex++) {
        if (setIndex === candidate.variable) continue;
        if ((reduced.sets[setIndex - 1] || []).some(element => chosenElements.has(element))) {
          forced.push({ variable: setIndex, value: 0 });
        }
      }
      if (reduced.universeSize % 3 === 0 && selectedTrueVariables(assignment, reduced.setCount).length >= reduced.universeSize / 3) {
        for (let setIndex = 1; setIndex <= reduced.setCount; setIndex++) {
          if (assignment[setIndex] === -1) forced.push({ variable: setIndex, value: 0 });
        }
      }
      return forced;
    }
  });
  if (reduced.forcedSets.length > 0 || reduced.universeSize !== universeSize || reduced.setCount !== setCount) {
    append(lines, `X3C exact precheck forced sets = ${reduced.forcedSets.length}; reduced universe size = ${reduced.universeSize} / original ${universeSize}; reduced set count = ${reduced.setCount} / original ${setCount}`);
  }
  return lines.join("\n");
}

function reduceGraphColoringBySafeRules(n, colorCount, edges) {
  const normalized = normalizeUndirectedEdges(n, edges);
  const coloring = Array(n + 1).fill(0);
  if (normalized.length === 0) {
    for (let vertex = 1; vertex <= n; vertex++) coloring[vertex] = 1;
    return {
      solved: true,
      answer: true,
      coloring,
      reason: "graph has no edges",
      n,
      edges: normalized,
      vertexMap: Array.from({ length: n }, (_, index) => index + 1),
      peeled: 0
    };
  }

  if (colorCount === 1) {
    return {
      solved: true,
      answer: false,
      coloring: null,
      reason: "a graph with at least one edge cannot be colored with 1 color",
      n,
      edges: normalized,
      vertexMap: Array.from({ length: n }, (_, index) => index + 1),
      peeled: 0
    };
  }

  const adjacency = Array.from({ length: n + 1 }, () => new Set());
  for (const [u, v] of normalized) {
    adjacency[u].add(v);
    adjacency[v].add(u);
  }

  if (colorCount === 2) {
    for (let start = 1; start <= n; start++) {
      if (coloring[start]) continue;
      coloring[start] = 1;
      const queue = [start];
      for (let index = 0; index < queue.length; index++) {
        const vertex = queue[index];
        const nextColor = coloring[vertex] === 1 ? 2 : 1;
        for (const neighbor of adjacency[vertex]) {
          if (!coloring[neighbor]) {
            coloring[neighbor] = nextColor;
            queue.push(neighbor);
          } else if (coloring[neighbor] === coloring[vertex]) {
            return {
              solved: true,
              answer: false,
              coloring: null,
              reason: `edge ${vertex}-${neighbor} creates an odd-cycle conflict for 2 colors`,
              n,
              edges: normalized,
              vertexMap: Array.from({ length: n }, (_, index) => index + 1),
              peeled: 0
            };
          }
        }
      }
    }
    return {
      solved: true,
      answer: true,
      coloring,
      reason: "graph is bipartite",
      n,
      edges: normalized,
      vertexMap: Array.from({ length: n }, (_, index) => index + 1),
      peeled: 0
    };
  }

  const active = Array(n + 1).fill(true);
  active[0] = false;
  const removedOrder = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let vertex = 1; vertex <= n; vertex++) {
      if (!active[vertex]) continue;
      let activeDegree = 0;
      for (const neighbor of adjacency[vertex]) if (active[neighbor]) activeDegree += 1;
      if (activeDegree < colorCount) {
        active[vertex] = false;
        removedOrder.push(vertex);
        changed = true;
      }
    }
  }

  const vertexMap = [];
  const remap = Array(n + 1).fill(0);
  for (let vertex = 1; vertex <= n; vertex++) {
    if (!active[vertex]) continue;
    remap[vertex] = vertexMap.length + 1;
    vertexMap.push(vertex);
  }

  if (vertexMap.length === 0) {
    const solvedColoring = Array(n + 1).fill(0);
    for (let orderIndex = removedOrder.length - 1; orderIndex >= 0; orderIndex--) {
      const vertex = removedOrder[orderIndex];
      const blocked = new Set();
      for (const neighbor of adjacency[vertex]) {
        if (solvedColoring[neighbor]) blocked.add(solvedColoring[neighbor]);
      }
      for (let candidateColor = 1; candidateColor <= colorCount; candidateColor++) {
        if (!blocked.has(candidateColor)) {
          solvedColoring[vertex] = candidateColor;
          break;
        }
      }
    }
    return {
      solved: true,
      answer: true,
      coloring: solvedColoring,
      reason: `graph is ${colorCount - 1}-degenerate or better`,
      n: 0,
      edges: [],
      vertexMap,
      removedOrder,
      peeled: removedOrder.length
    };
  }

  const reducedEdges = [];
  for (const [u, v] of normalized) {
    if (!active[u] || !active[v]) continue;
    reducedEdges.push([remap[u], remap[v]]);
  }

  return {
    solved: false,
    answer: null,
    coloring: null,
    reason: "",
    n: vertexMap.length,
    edges: reducedEdges,
    vertexMap,
    removedOrder,
    peeled: removedOrder.length
  };
}

function extendGraphColoringFromCore(coreColoring, reduced, originalN, colorCount, originalEdges) {
  const coloring = Array(originalN + 1).fill(0);
  for (let vertex = 1; vertex <= reduced.n; vertex++) {
    coloring[reduced.vertexMap[vertex - 1]] = coreColoring[vertex];
  }

  const adjacency = Array.from({ length: originalN + 1 }, () => []);
  for (const [u, v] of normalizeUndirectedEdges(originalN, originalEdges)) {
    adjacency[u].push(v);
    adjacency[v].push(u);
  }

  for (let orderIndex = (reduced.removedOrder || []).length - 1; orderIndex >= 0; orderIndex--) {
    const vertex = reduced.removedOrder[orderIndex];
    const blocked = new Set();
    for (const neighbor of adjacency[vertex]) {
      if (coloring[neighbor]) blocked.add(coloring[neighbor]);
    }
    for (let candidateColor = 1; candidateColor <= colorCount; candidateColor++) {
      if (!blocked.has(candidateColor)) {
        coloring[vertex] = candidateColor;
        break;
      }
    }
    if (!coloring[vertex]) return null;
  }
  return coloring;
}

function graphColorName(index) {
  const names = ["", "red", "green", "blue", "yellow", "purple", "orange", "cyan", "magenta", "gray"];
  return names[index] || `color${index}`;
}

function runGraphColoring(text) {
  const { n, declaredEdgeCount, colorCount, padding, edges } = parseGraphColoring(text);
  const reduced = reduceGraphColoringBySafeRules(n, colorCount, edges);
  const lines = [];

  if (reduced.solved) {
    append(lines, "Final answer:");
    append(lines, `Graph Coloring answer inferred before HC witness choices: ${reduced.answer ? "YES" : "NO"}`);
    if (reduced.reason) append(lines, `reason = ${reduced.reason}`);
    if (reduced.answer && reduced.coloring) {
      append(lines);
      append(lines, "Witnesses inferred from exact precheck:");
      append(lines, `1. coloring = ${formatGraphColoringWitness(reduced.coloring, n)}; colors used = ${formatSet(Array.from(new Set(reduced.coloring.slice(1))).sort((a, b) => a - b).map(graphColorName))}`);
    }
    append(lines);
    append(lines, "Run summary:");
    append(lines, `Graph Coloring exact precheck peeled vertices = ${reduced.peeled || 0}; reduced vertices = ${reduced.n} / original ${n}`);
    return lines.join("\n");
  }

  const sat = graphColoringTo3Sat(reduced.n, colorCount, reduced.edges);
  const prepared = prepareSatViaVertexCoverForHc(sat, padding);

  appendSatViaVertexCoverHcReduction(lines, prepared, "Graph Coloring via 3-SAT -> Vertex Cover -> direct HC", "Graph Coloring", "YES", "NO", search => {
    const limit = witnessDisplayLimit();
    const colorings = search.satisfyingAssignments
      .slice(0, limit)
      .map(item => graphColorFromAssignment(item.decisionAssignment || item.assignment, reduced.n, colorCount))
      .map(color => color ? extendGraphColoringFromCore(color, reduced, n, colorCount, edges) : null)
      .filter(Boolean);
    if (colorings.length === 0) return ["coloring witness unavailable even though HC returned YES"];
    return [
      `colorings shown = ${colorings.length} / found ${search.satisfyingAssignments.length}`,
      ...colorings.map((color, index) => `${index + 1}. coloring = ${formatGraphColoringWitness(color, n)}; colors used = ${formatSet(Array.from(new Set(color.slice(1))).sort((a, b) => a - b).map(graphColorName))}`)
    ];
  }, {
    formulaVariableCount: sat.variableCount,
    formulaClauses: sat.clauses,
    decisionVariableCount: reduced.n * colorCount,
    assignmentValidator: assignment => graphColorAssignmentValid(assignment, reduced.n, colorCount, reduced.edges),
    partialAssignmentValidator: assignment => {
      for (let vertex = 1; vertex <= reduced.n; vertex++) {
        let trueCount = 0;
        for (let candidateColor = 1; candidateColor <= colorCount; candidateColor++) {
          if (assignment[colorCount * (vertex - 1) + candidateColor] === 1) trueCount += 1;
        }
        if (trueCount > 1) return false;
      }
      for (const [u, v] of reduced.edges) {
        for (let candidateColor = 1; candidateColor <= colorCount; candidateColor++) {
          if (assignment[colorCount * (u - 1) + candidateColor] === 1 &&
              assignment[colorCount * (v - 1) + candidateColor] === 1) return false;
        }
      }
      return true;
    },
    decisionCandidateFilter: candidate => candidate.value === 1,
    forcedDecisionsAfterChoice: candidate => {
      if (candidate.value !== 1) return [];
      const vertex = Math.floor((candidate.variable - 1) / colorCount) + 1;
      const chosenColor = ((candidate.variable - 1) % colorCount) + 1;
      const forced = [];
      for (let candidateColor = 1; candidateColor <= colorCount; candidateColor++) {
        if (candidateColor === chosenColor) continue;
        forced.push({ variable: colorCount * (vertex - 1) + candidateColor, value: 0 });
      }
      return forced;
    }
  });
  if (reduced.peeled > 0 || reduced.n !== n) {
    append(lines, `Graph Coloring exact precheck peeled vertices = ${reduced.peeled}; reduced vertices = ${reduced.n} / original ${n}`);
  }
  return lines.join("\n");
}

function runSudoku() {
  const puzzle = readSudokuPuzzle();
  const compactMode = puzzle.n <= 16;
  const sat = compactMode ? sudokuTo3Sat(puzzle) : summarizeLargeSudokuReduction(puzzle);
  const denseLimit = Math.max(0, Math.floor(readNonnegativeNumber("sudokuHcLimit", "Dense HC calculation node limit")));
  const prepared = compactMode ? prepareSatViaVertexCoverForHc(sat, 0, denseLimit) : null;
  const stats = compactMode && !prepared.simplified.contradiction
    ? prepared.stats
    : estimateSatToVertexCoverReduction(sat.variableCount, sat.clauseCount || 0, 0);
  const lines = [];
  if (compactMode && prepared.simplified.contradiction) {
    append(lines, "Final answer:");
    append(lines, "Sudoku answer after exact unit simplification: NO SOLUTION");
  }
  if (compactMode && !prepared.simplified.contradiction && !prepared.skipped) {
    appendSatViaVertexCoverHcReduction(lines, prepared, "Sudoku via 3-SAT -> Vertex Cover -> direct HC", "Sudoku", "SOLUTION EXISTS", "NO SOLUTION", search => {
      const item = search.satisfyingAssignments[0];
      if (!item) return ["Sudoku witness unavailable even though HC returned YES"];
      const solution = sudokuGridFromAssignment(item.decisionAssignment || item.assignment, puzzle);
      if (!solution) return ["Sudoku witness assignment could not be converted to a grid"];
      applySudokuSolution(puzzle, solution);
      return ["Sudoku grid:", formatSudokuGrid(solution, puzzle.symbols)];
    }, {
      formulaVariableCount: sat.variableCount,
      formulaClauses: sat.clauses,
      decisionVariableCount: sat.baseVariableCount,
      assignmentValidator: assignment => sudokuAssignmentValid(assignment, puzzle),
      partialAssignmentValidator: assignment => {
        const hasDuplicateTrue = variables => {
          let seen = 0;
          for (const variable of variables) {
            if (assignment[variable] === 1) seen += 1;
          }
          return seen > 1;
        };
        for (let row = 0; row < puzzle.n; row++) {
          for (let digit = 1; digit <= puzzle.n; digit++) {
            const variables = [];
            for (let col = 0; col < puzzle.n; col++) variables.push(((row * puzzle.n + col) * puzzle.n) + digit);
            if (hasDuplicateTrue(variables)) return false;
          }
        }
        for (let col = 0; col < puzzle.n; col++) {
          for (let digit = 1; digit <= puzzle.n; digit++) {
            const variables = [];
            for (let row = 0; row < puzzle.n; row++) variables.push(((row * puzzle.n + col) * puzzle.n) + digit);
            if (hasDuplicateTrue(variables)) return false;
          }
        }
        for (let boxRow = 0; boxRow < puzzle.n; boxRow += puzzle.boxSize) {
          for (let boxCol = 0; boxCol < puzzle.n; boxCol += puzzle.boxSize) {
            for (let digit = 1; digit <= puzzle.n; digit++) {
              const variables = [];
              for (let row = boxRow; row < boxRow + puzzle.boxSize; row++) {
                for (let col = boxCol; col < boxCol + puzzle.boxSize; col++) variables.push(((row * puzzle.n + col) * puzzle.n) + digit);
              }
              if (hasDuplicateTrue(variables)) return false;
            }
          }
        }
        return true;
      },
      decisionCandidateFilter: candidate => candidate.value === 1,
      forcedDecisionsAfterChoice: candidate => {
        if (candidate.value !== 1) return [];
        const zeroBased = candidate.variable - 1;
        const cellIndex = Math.floor(zeroBased / puzzle.n);
        const currentDigit = (zeroBased % puzzle.n) + 1;
        const forced = [];
        for (let digit = 1; digit <= puzzle.n; digit++) {
          if (digit === currentDigit) continue;
          forced.push({ variable: (cellIndex * puzzle.n) + digit, value: 0 });
        }
        return forced;
      }
    });
  } else if (!compactMode || !prepared.simplified.contradiction) {
    append(lines, "Final answer:");
    append(lines, "Sudoku answer inferred from HC witness choices: NOT COMPUTED");
    append(lines);
    append(lines, "Run summary:");
    append(lines, `estimated HC nodes after Vertex Cover gadget = ${stats.hcNodes}`);
    append(lines, `HC solver not run because ${stats.hcNodes} nodes is above the safety limit ${denseLimit}${compactMode ? "" : " or the Sudoku is in 25x25 large mode"}.`);
  }
  return lines.join("\n");
}

function readPositiveNumber(id, label) {
  const value = Number(document.getElementById(id).value);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero.`);
  return value;
}

function readNonnegativeNumber(id, label) {
  const value = Number(document.getElementById(id).value);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} cannot be negative.`);
  return value;
}

function uniqueOrientations(box, allowRotate, keepUpright) {
  const choices = allowRotate
    ? (keepUpright
      ? [[box.l, box.w, box.h], [box.w, box.l, box.h]]
      : [
        [box.l, box.w, box.h], [box.l, box.h, box.w],
        [box.w, box.l, box.h], [box.w, box.h, box.l],
        [box.h, box.l, box.w], [box.h, box.w, box.l]
      ])
    : [[box.l, box.w, box.h]];
  const seen = new Set();
  const orientations = [];
  for (const [l, w, h] of choices) {
    const key = `${l}:${w}:${h}`;
    if (seen.has(key)) continue;
    seen.add(key);
    orientations.push({ l, w, h });
  }
  return orientations;
}

function readPackingInput() {
  const truck = {
    l: readPositiveNumber("truckLength", "Truck length"),
    w: readPositiveNumber("truckWidth", "Truck width"),
    h: readPositiveNumber("truckHeight", "Truck height"),
    maxWeight: readNonnegativeNumber("truckMaxWeight", "Max weight")
  };
  const candidateBudget = Math.max(1, Math.floor(readPositiveNumber("packingCandidateBudget", "Max packing options sent to HC")));
  const allowRotate = document.getElementById("packingAllowRotate").checked;
  const keepUpright = document.getElementById("packingKeepUpright").checked;
  const types = [];
  document.querySelectorAll("#packingBoxRows .boxRow").forEach((row, index) => {
    const name = row.querySelector(".boxName").value.trim() || `Box${index + 1}`;
    const l = Number(row.querySelector(".boxL").value);
    const w = Number(row.querySelector(".boxW").value);
    const h = Number(row.querySelector(".boxH").value);
    const weight = Number(row.querySelector(".boxWeight").value);
    const qty = Number(row.querySelector(".boxQty").value);
    const maxTop = Number(row.querySelector(".boxMaxTop").value);
    if (![l, w, h].every(value => Number.isFinite(value) && value > 0)) throw new Error(`${name} dimensions must be greater than zero.`);
    if (!Number.isFinite(weight) || weight < 0) throw new Error(`${name} weight cannot be negative.`);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error(`${name} quantity must be a positive integer.`);
    if (!Number.isFinite(maxTop) || maxTop < 0) throw new Error(`${name} max top weight cannot be negative.`);
    types.push({
      name, l, w, h, weight, qty, maxTop,
      stackable: row.querySelector(".boxStackable").checked,
      fragile: row.querySelector(".boxFragile").checked
    });
  });
  if (types.length === 0) throw new Error("Add at least one box type.");
  return { truck, candidateBudget, allowRotate, keepUpright, types };
}

function expandPackingItems(types) {
  const items = [];
  types.forEach((type, typeIndex) => {
    for (let copy = 1; copy <= type.qty; copy++) {
      items.push({ ...type, typeIndex, copy, id: `${type.name}#${copy}`, volume: type.l * type.w * type.h });
    }
  });
  return items;
}

function packingBoxesOverlap(a, b) {
  return a.x < b.x + b.l && a.x + a.l > b.x &&
    a.y < b.y + b.w && a.y + a.w > b.y &&
    a.z < b.z + b.h && a.z + a.h > b.z;
}

function packingFootprintOverlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y));
  return x * y;
}

function placementSupport(point, orientation, item, placed) {
  if (point.z === 0) return { ok: true, supports: [] };
  const candidate = { x: point.x, y: point.y, z: point.z, ...orientation };
  const supports = [];
  let supportedArea = 0;
  for (const box of placed) {
    if (Math.abs((box.z + box.h) - point.z) > 1e-9) continue;
    const area = packingFootprintOverlap(candidate, box);
    if (area <= 0) continue;
    if (!box.stackable || box.fragile) return { ok: false, supports: [] };
    supportedArea += area;
    supports.push({ box, area });
  }
  const footprint = orientation.l * orientation.w;
  if (supportedArea + 1e-9 < footprint * 0.6) return { ok: false, supports: [] };
  for (const support of supports) {
    const share = item.weight * (support.area / supportedArea);
    if (support.box.loadOnTop + share > support.box.maxTop + 1e-9) return { ok: false, supports: [] };
  }
  return { ok: true, supports };
}

function placementFitsTruck(point, orientation, truck) {
  return point.x >= 0 && point.y >= 0 && point.z >= 0 &&
    point.x + orientation.l <= truck.l + 1e-9 &&
    point.y + orientation.w <= truck.w + 1e-9 &&
    point.z + orientation.h <= truck.h + 1e-9;
}

function cleanPackingPoints(points, placed, truck) {
  const seen = new Set();
  const clean = [];
  for (const point of points) {
    if (point.x > truck.l || point.y > truck.w || point.z > truck.h) continue;
    const key = `${point.x}:${point.y}:${point.z}`;
    if (seen.has(key)) continue;
    let inside = false;
    for (const box of placed) {
      if (point.x > box.x && point.x < box.x + box.l &&
          point.y > box.y && point.y < box.y + box.w &&
          point.z > box.z && point.z < box.z + box.h) {
        inside = true;
        break;
      }
    }
    if (!inside) {
      seen.add(key);
      clean.push(point);
    }
  }
  clean.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  return clean;
}

function packBoxesExtremePoint(input) {
  const items = expandPackingItems(input.types).sort((a, b) =>
    Number(a.fragile) - Number(b.fragile) ||
    b.volume - a.volume ||
    b.weight - a.weight
  );
  const placed = [];
  const unpacked = [];
  let points = [{ x: 0, y: 0, z: 0 }];
  let totalWeight = 0;
  const palette = ["#2dd4bf", "#60a5fa", "#f59e0b", "#f472b6", "#a78bfa", "#34d399", "#f87171", "#eab308"];

  for (const item of items) {
    let chosen = null;
    const orientations = uniqueOrientations(item, input.allowRotate, input.keepUpright);
    for (const point of points) {
      for (const orientation of orientations) {
        if (!placementFitsTruck(point, orientation, input.truck)) continue;
        if (totalWeight + item.weight > input.truck.maxWeight + 1e-9) continue;
        const candidate = { x: point.x, y: point.y, z: point.z, ...orientation };
        if (placed.some(box => packingBoxesOverlap(candidate, box))) continue;
        const support = placementSupport(point, orientation, item, placed);
        if (!support.ok) continue;
        chosen = { point, orientation, support };
        break;
      }
      if (chosen) break;
    }

    if (!chosen) {
      unpacked.push(item);
      continue;
    }

    const box = {
      ...item,
      x: chosen.point.x,
      y: chosen.point.y,
      z: chosen.point.z,
      l: chosen.orientation.l,
      w: chosen.orientation.w,
      h: chosen.orientation.h,
      color: palette[item.typeIndex % palette.length],
      loadOnTop: 0
    };
    const supportArea = chosen.support.supports.reduce((sum, support) => sum + support.area, 0);
    for (const support of chosen.support.supports) {
      support.box.loadOnTop += item.weight * (support.area / supportArea);
    }
    placed.push(box);
    totalWeight += item.weight;
    points.push({ x: box.x + box.l, y: box.y, z: box.z });
    points.push({ x: box.x, y: box.y + box.w, z: box.z });
    points.push({ x: box.x, y: box.y, z: box.z + box.h });
    points = cleanPackingPoints(points, placed, input.truck);
  }

  return { items, placed, unpacked, totalWeight, usedVolume: placed.reduce((sum, box) => sum + box.l * box.w * box.h, 0) };
}

function buildPackingCandidateReduction(input, packed) {
  const items = packed.items;
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const totalVolume = items.reduce((sum, item) => sum + item.volume, 0);
  const truckVolume = input.truck.l * input.truck.w * input.truck.h;
  const impossibleReasons = [];
  const points = [{ x: 0, y: 0, z: 0 }];
  for (const box of packed.placed) {
    points.push({ x: box.x, y: box.y, z: box.z });
    points.push({ x: box.x + box.l, y: box.y, z: box.z });
    points.push({ x: box.x, y: box.y + box.w, z: box.z });
    points.push({ x: box.x, y: box.y, z: box.z + box.h });
  }
  const candidates = [];
  const lockedKeys = new Set();
  for (const box of packed.placed) {
    const key = `${box.id}:${box.x}:${box.y}:${box.z}:${box.l}:${box.w}:${box.h}`;
    lockedKeys.add(key);
    candidates.push({ itemId: box.id, item: box, x: box.x, y: box.y, z: box.z, l: box.l, w: box.w, h: box.h, locked: true });
  }
  for (const item of items) {
    for (const point of points) {
      for (const orientation of uniqueOrientations(item, input.allowRotate, input.keepUpright)) {
        if (!placementFitsTruck(point, orientation, input.truck)) continue;
        const key = `${item.id}:${point.x}:${point.y}:${point.z}:${orientation.l}:${orientation.w}:${orientation.h}`;
        if (lockedKeys.has(key)) continue;
        candidates.push({ itemId: item.id, item, x: point.x, y: point.y, z: point.z, ...orientation, locked: false });
      }
    }
  }

  const locked = candidates.filter(candidate => candidate.locked);
  const flexible = candidates.filter(candidate => !candidate.locked)
    .sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x || b.item.volume - a.item.volume);
  const kept = locked.concat(flexible.slice(0, Math.max(0, input.candidateBudget - locked.length)));
  kept.forEach((candidate, index) => candidate.variable = index + 1);

  const byItem = new Map();
  for (const candidate of kept) {
    if (!byItem.has(candidate.itemId)) byItem.set(candidate.itemId, []);
    byItem.get(candidate.itemId).push(candidate);
  }

  const clauses = [];
  let variableCount = kept.length || 1;
  let rawClauseCount = 0;
  const addClauseAs3Sat = literals => {
    rawClauseCount += 1;
    if (literals.length === 0) {
      clauses.push([1, 1, 1]);
      clauses.push([-1, -1, -1]);
      return;
    }
    if (literals.length === 1) {
      clauses.push([literals[0], literals[0], literals[0]]);
      return;
    }
    if (literals.length === 2) {
      clauses.push([literals[0], literals[1], literals[1]]);
      return;
    }
    if (literals.length === 3) {
      clauses.push(literals);
      return;
    }
    let previousAux = ++variableCount;
    clauses.push([literals[0], literals[1], previousAux]);
    for (let index = 2; index < literals.length - 2; index++) {
      const nextAux = ++variableCount;
      clauses.push([-previousAux, literals[index], nextAux]);
      previousAux = nextAux;
    }
    clauses.push([-previousAux, literals[literals.length - 2], literals[literals.length - 1]]);
  };

  for (const item of items) {
    const choices = byItem.get(item.id) || [];
    addClauseAs3Sat(choices.map(candidate => candidate.variable));
    for (let left = 0; left < choices.length; left++) {
      for (let right = left + 1; right < choices.length; right++) {
        addClauseAs3Sat([-choices[left].variable, -choices[right].variable]);
      }
    }
  }

  if (totalWeight > input.truck.maxWeight + 1e-9) impossibleReasons.push("total box weight exceeds truck max weight");
  if (totalVolume > truckVolume + 1e-9) impossibleReasons.push("total box volume exceeds truck volume");
  if (impossibleReasons.length) addClauseAs3Sat([]);

  for (let left = 0; left < kept.length; left++) {
    for (let right = left + 1; right < kept.length; right++) {
      if (kept[left].itemId === kept[right].itemId) continue;
      if (packingBoxesOverlap(kept[left], kept[right])) addClauseAs3Sat([-kept[left].variable, -kept[right].variable]);
    }
  }

  return {
    variableCount,
    clauses,
    rawClauseCount,
    generatedCandidates: candidates.length,
    keptCandidates: kept.length,
    candidatePlacements: kept,
    itemCount: items.length,
    impossibleReasons,
    pruned: candidates.length > kept.length
  };
}

function projectPackingPoint(x, y, z, scale, originX, originY) {
  return {
    x: originX + (x - y) * scale,
    y: originY + (x + y) * scale * 0.42 - z * scale
  };
}

function drawPackingBox(ctx, box, scale, originX, originY) {
  const p = (x, y, z) => projectPackingPoint(x, y, z, scale, originX, originY);
  const a = p(box.x, box.y, box.z);
  const b = p(box.x + box.l, box.y, box.z);
  const c = p(box.x + box.l, box.y + box.w, box.z);
  const d = p(box.x, box.y + box.w, box.z);
  const e = p(box.x, box.y, box.z + box.h);
  const f = p(box.x + box.l, box.y, box.z + box.h);
  const g = p(box.x + box.l, box.y + box.w, box.z + box.h);
  const h = p(box.x, box.y + box.w, box.z + box.h);
  const face = (points, color, alpha) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#081018";
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  face([e, f, g, h], box.color, 0.95);
  face([b, c, g, f], box.color, 0.72);
  face([d, c, g, h], box.color, 0.55);
  ctx.fillStyle = "#061014";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(box.name, (e.x + g.x) / 2 - 8, (e.y + g.y) / 2 + 4);
}

function drawPackingScene(truck, placed) {
  const canvas = document.getElementById("packingCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#070b10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(30, (canvas.width * 0.42) / Math.max(1, truck.l + truck.w), (canvas.height * 0.62) / Math.max(1, truck.h + (truck.l + truck.w) * 0.42));
  const originX = canvas.width / 2;
  const originY = canvas.height * 0.68;
  const sorted = placed.slice().sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
  for (const box of sorted) drawPackingBox(ctx, box, scale, originX, originY);
  const p = (x, y, z) => projectPackingPoint(x, y, z, scale, originX, originY);
  const corners = [
    p(0, 0, 0), p(truck.l, 0, 0), p(truck.l, truck.w, 0), p(0, truck.w, 0),
    p(0, 0, truck.h), p(truck.l, 0, truck.h), p(truck.l, truck.w, truck.h), p(0, truck.w, truck.h)
  ];
  const lines = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  ctx.strokeStyle = "#9af4ea";
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.75;
  for (const [from, to] of lines) {
    ctx.beginPath();
    ctx.moveTo(corners[from].x, corners[from].y);
    ctx.lineTo(corners[to].x, corners[to].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#cbd5df";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(`${placed.length} boxes packed`, 14, 24);
}

function addPackingBoxRow(defaults = {}) {
  const tbody = document.getElementById("packingBoxRows");
  const row = document.createElement("tr");
  row.className = "boxRow";
  row.innerHTML = `
    <td><input class="boxName" value="${defaults.name || "New"}"></td>
    <td><input class="boxL" type="number" min="1" step="any" value="${defaults.l || 2}"></td>
    <td><input class="boxW" type="number" min="1" step="any" value="${defaults.w || 2}"></td>
    <td><input class="boxH" type="number" min="1" step="any" value="${defaults.h || 2}"></td>
    <td><input class="boxWeight" type="number" min="0" step="any" value="${defaults.weight || 50}"></td>
    <td><input class="boxQty" type="number" min="1" step="1" value="${defaults.qty || 1}"></td>
    <td><input class="boxStackable" type="checkbox" checked></td>
    <td><input class="boxFragile" type="checkbox"></td>
    <td><input class="boxMaxTop" type="number" min="0" step="any" value="${defaults.maxTop || 200}"></td>
    <td><button class="removeBoxType" type="button" title="Remove">X</button></td>`;
  tbody.appendChild(row);
}

function runPacking3d() {
  const input = readPackingInput();
  const packed = packBoxesExtremePoint(input);
  drawPackingScene(input.truck, packed.placed);
  const reduction = buildPackingCandidateReduction(input, packed);
  const prepared = prepareSatViaVertexCoverForHc(reduction, 0);
  const lines = [];
  appendSatViaVertexCoverHcReduction(lines, prepared, "3D packing via 3-SAT -> Vertex Cover -> direct HC", "Packing candidate model", "YES", "NO", search => {
    const item = search.satisfyingAssignments[0];
    if (!item) return ["no packed box placements in the current candidate manifest"];
    const selected = selectedTrueVariables(item.decisionAssignment || item.assignment, reduction.keptCandidates)
      .map(index => reduction.candidatePlacements[index - 1])
      .filter(Boolean);
    if (selected.length === 0) return ["no packed box placements selected by the HC witness choices"];
    return [
      `packed boxes = ${formatSet(selected.map(box => box.itemId))}`,
      ...selected.map((box, index) => `${index + 1}. ${box.itemId} at (${box.x},${box.y},${box.z}) size ${box.l}x${box.w}x${box.h}`),
      `unpacked boxes = ${formatSet(packed.unpacked.map(item => item.id))}`
    ];
  }, {
    formulaVariableCount: reduction.variableCount,
    formulaClauses: reduction.clauses,
    decisionVariableCount: reduction.keptCandidates,
    assignmentValidator: assignment => packingAssignmentValid(assignment, reduction.candidatePlacements || []),
    partialAssignmentValidator: assignment => {
      const candidates = reduction.candidatePlacements || [];
      const selected = selectedTrueVariables(assignment, candidates.length).map(index => candidates[index - 1]);
      const seenItems = new Set();
      for (const candidate of selected) {
        if (seenItems.has(candidate.itemId)) return false;
        seenItems.add(candidate.itemId);
      }
      for (let left = 0; left < selected.length; left++) {
        for (let right = left + 1; right < selected.length; right++) {
          if (selected[left].itemId !== selected[right].itemId && packingBoxesOverlap(selected[left], selected[right])) return false;
        }
      }
      return true;
    }
  });
  return lines.join("\n");
}

function normalizeClauseLiterals(literals) {
  const seen = new Set();
  const normalized = [];
  for (const literal of literals) {
    if (seen.has(-literal)) return { tautology: true, literals: [] };
    if (seen.has(literal)) continue;
    seen.add(literal);
    normalized.push(literal);
  }
  return { tautology: false, literals: normalized };
}

function simplify3SatForHc(variableCount, clauses) {
  let activeClauses = [];
  let tautologyClauses = 0;
  let satisfiedClauses = 0;
  let forcedAssignments = 0;
  const assignment = Array(variableCount + 1).fill(0);

  for (const clause of clauses) {
    const normalized = normalizeClauseLiterals(clause);
    if (normalized.tautology) {
      tautologyClauses += 1;
    } else {
      activeClauses.push(normalized.literals);
    }
  }

  while (true) {
    const nextClauses = [];
    const units = [];

    for (const clause of activeClauses) {
      let satisfied = false;
      const remaining = [];
      for (const literal of clause) {
        const variable = Math.abs(literal);
        const value = assignment[variable] || 0;
        if (value === 0) {
          remaining.push(literal);
        } else if ((literal > 0 && value === 1) || (literal < 0 && value === -1)) {
          satisfied = true;
          break;
        }
      }
      if (satisfied) {
        satisfiedClauses += 1;
        continue;
      }

      const normalized = normalizeClauseLiterals(remaining);
      if (normalized.tautology) {
        tautologyClauses += 1;
        continue;
      }
      if (normalized.literals.length === 0) {
        return {
          variableCount,
          clauses: [],
          assignment,
          contradiction: true,
          contradictionReason: "a clause became empty during unit propagation",
          originalClauseCount: clauses.length,
          simplifiedClauseCount: 0,
          finalClauseCount: 0,
          tautologyClauses,
          satisfiedClauses,
          forcedAssignments,
          binaryExpandedClauses: 0,
          auxiliaryVariablesAdded: 0
        };
      }
      if (normalized.literals.length === 1) units.push(normalized.literals[0]);
      nextClauses.push(normalized.literals);
    }

    let changed = false;
    for (const literal of units) {
      const variable = Math.abs(literal);
      const desired = literal > 0 ? 1 : -1;
      if (assignment[variable] !== 0 && assignment[variable] !== desired) {
        return {
          variableCount,
          clauses: [],
          assignment,
          contradiction: true,
          contradictionReason: `unit clauses force both x${variable} and ~x${variable}`,
          originalClauseCount: clauses.length,
          simplifiedClauseCount: 0,
          finalClauseCount: 0,
          tautologyClauses,
          satisfiedClauses,
          forcedAssignments,
          binaryExpandedClauses: 0,
          auxiliaryVariablesAdded: 0
        };
      }
      if (assignment[variable] === 0) {
        assignment[variable] = desired;
        forcedAssignments += 1;
        changed = true;
      }
    }

    activeClauses = nextClauses;
    if (!changed) break;
  }

  const simplifiedClauseCount = activeClauses.length;
  const finalClauses = [];
  let nextVariable = variableCount;
  let binaryExpandedClauses = 0;

  for (const clause of activeClauses) {
    if (clause.length === 2) {
      finalClauses.push(clause);
      binaryExpandedClauses += 1;
    } else if (clause.length === 3) {
      finalClauses.push(clause);
    } else if (clause.length > 3) {
      let previousAux = ++nextVariable;
      finalClauses.push([clause[0], clause[1], previousAux]);
      for (let index = 2; index < clause.length - 2; index++) {
        const nextAux = ++nextVariable;
        finalClauses.push([-previousAux, clause[index], nextAux]);
        previousAux = nextAux;
      }
      finalClauses.push([-previousAux, clause[clause.length - 2], clause[clause.length - 1]]);
    }
  }

  return {
    variableCount: nextVariable,
    clauses: finalClauses,
    assignment,
    contradiction: false,
    contradictionReason: "",
    originalClauseCount: clauses.length,
    simplifiedClauseCount,
    finalClauseCount: finalClauses.length,
    tautologyClauses,
    satisfiedClauses,
    forcedAssignments,
    binaryExpandedClauses,
    auxiliaryVariablesAdded: nextVariable - variableCount
  };
}

function run3SatCompressed(text) {
  const { variableCount, clauseCount, padding, clauses } = parse3Sat(text);
  const prepared = prepareSatViaVertexCoverForHc({ variableCount, clauses }, padding);
  const lines = [];
  if (prepared.simplified.contradiction) {
    append(lines, "Final answer:");
    append(lines, "Original 3-SAT answer after exact unit simplification: UNSATISFIABLE");
    append(lines, `reason = ${prepared.simplified.contradictionReason}`);
    return lines.join("\n");
  }

  if (prepared.skipped) {
    append(lines, "Final answer:");
    append(lines, "Original 3-SAT answer inferred from HC witness choices: NOT COMPUTED");
    append(lines);
    append(lines, "Run summary:");
    append(lines, `estimated HC nodes after Vertex Cover gadget = ${prepared.stats.hcNodes}`);
    append(lines, `HC solver not run because ${prepared.skipReason}.`);
    return lines.join("\n");
  }

  const search = runSatWitnessHcDecisionSearch(prepared, variableCount, clauses);
  append(lines, "Final answer:");
  append(lines, search.hamiltonianFound
    ? "Original 3-SAT answer inferred from HC witness choices: SATISFIABLE"
    : "Original 3-SAT answer inferred from HC witness choices: NOT FOUND BY HC WITNESS SEARCH");
  append(lines, `HC nodes = ${prepared.graph.n}`);
  append(lines, `allowed HC edges scored = ${prepared.graph.allowedEdgeKeys.size}`);
  append(lines, `SAT witness choices scored = ${search.satDecisionChoices}`);
  append(lines, `SAT witness branches explored = ${search.explored}`);
  append(lines, `SAT witness branch limit = ${search.branchLimit}`);
  append(lines, `SAT assignments checked = ${search.assignmentsChecked}`);
  append(lines, `HC backtrack tries = ${search.requestedBacktracks}`);
  append(lines, `HC tour search mode = ${shouldStopAtFirstHcTour() ? "stop at first HC tour" : "search all tries"}`);
  append(lines, `VC/degree-2 forced edges before SAT choices = ${search.initialForcedEdges}`);
  if (search.hamiltonianFound) {
    append(lines, "HC decision: HAMILTONIAN CYCLE WITNESS ACCEPTED");
    append(lines, `HC target cost = ${formatNumber(-prepared.graph.n)}`);
    append(lines, `HC witness decision cost = ${formatNumber(search.totalTourCost)}`);
  } else {
    append(lines, "HC decision: HAMILTONIAN CYCLE WITNESS NOT FOUND");
    if (search.bestFailureReason) append(lines, `best failed reason = ${search.bestFailureReason}`);
  }

  if (search.satisfyingAssignments.length > 0) {
    const limit = witnessDisplayLimit();
    const shown = search.satisfyingAssignments.slice(0, limit);
    append(lines);
    append(lines, "Witnesses inferred from HC:");
    append(lines, `assignments shown = ${shown.length} / found ${search.satisfyingAssignments.length}`);
    shown.forEach((item, index) => {
      append(lines, `${index + 1}. assignment = ${formatSatAssignmentWitness(item.assignment, variableCount)}`);
    });
  }
  return lines.join("\n");
}

async function loadFileInto(fileInput, textareaId) {
  const file = fileInput.files[0];
  if (!file) return;
  document.getElementById(textareaId).value = await file.text();
}

function compactRunOutput(text, elapsedMs) {
  const sourceLines = String(text || "").split(/\r?\n/);
  const lines = [];
  const seen = new Set();
  const add = line => {
    if (!line && lines[lines.length - 1] === "") return;
    const key = line.trim();
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    lines.push(line);
  };

  const finalIndex = sourceLines.findIndex(line => line.trim() === "Final answer:");
  if (finalIndex >= 0) {
    for (let index = finalIndex; index < sourceLines.length; index++) {
      const line = sourceLines[index];
      const next = sourceLines[index + 1] || "";
      if (index > finalIndex && line.trim() === "" && next.startsWith("NP-douce HC solver result:")) break;
      add(line);
    }
  } else {
    const decision = sourceLines.find(line => line.includes("HC decision:"));
    const totalCost = sourceLines.find(line => line.startsWith("Total tour cost =") || line.startsWith("HC tour cost ="));
    add("Final answer:");
    if (decision) add(decision);
    else if (totalCost) add(totalCost);
    else return text;
  }

  for (let index = 0; index < sourceLines.length; index++) {
    const line = sourceLines[index];
    if (!/witness/i.test(line)) continue;
    add("");
    add(line);
    for (let witnessIndex = index + 1; witnessIndex < sourceLines.length; witnessIndex++) {
      const witnessLine = sourceLines[witnessIndex];
      if (witnessLine.trim() === "") break;
      add(witnessLine);
    }
  }

  const nodePatterns = [
    /^HC nodes = /,
    /^undirected HC nodes = /,
    /^estimated HC nodes after Vertex Cover gadget = /,
    /^n = /,
    /nodes is above/
  ];
  const metricPatterns = [
    /^HC backtrack tries = /,
    /^HC tour search mode = /,
    /^backtrack try limit = /,
    /^requested backtrack tries = /,
    /^allowed HC edges scored = /,
    /^SAT decision variables checked = /,
    /^SAT witness choices scored = /,
    /^SAT witness branches explored = /,
    /^SAT witness branch limit = /,
    /^SAT assignments checked = /,
    /^Clique exact precheck removed vertices = /,
    /^Independent Set exact precheck removed vertices = /,
    /^VC exact precheck forced vertices = /,
    /^VC exact precheck removed isolated vertices = /,
    /^VC matching lower bound = /,
    /^Set Cover exact precheck forced sets = /,
    /^Set Cover reduced universe size = /,
    /^X3C exact precheck forced sets = /,
    /^X3C reduced universe size = /,
    /^Graph Coloring exact precheck peeled vertices = /,
    /^VC decision vertices checked = /,
    /^VC witness choices scored = /,
    /^VC witness branches explored = /,
    /^VC witness branch limit = /,
    /^VC assignments checked = /,
    /^VC\/degree-2 forced edges before SAT choices = /,
    /^VC\/degree-2 forced edges before choices = /,
    /^HC tour cost = /,
    /^best tour cost = /,
    /^HC target cost = /,
    /^HC best partial tour cost = /,
    /^best partial tour cost = /,
    /^HC tours found = /,
    /^best tours found = /,
    /^tour witnesses found = /,
    /^minimum tour cost found = /,
    /^distinct minimum tours found within try limit = /
  ];

  const metrics = [];
  const metricSeen = new Set();
  for (const line of sourceLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!nodePatterns.some(pattern => pattern.test(trimmed)) &&
        !metricPatterns.some(pattern => pattern.test(trimmed))) {
      continue;
    }
    if (metricSeen.has(trimmed)) continue;
    metricSeen.add(trimmed);
    metrics.push(trimmed);
  }

  if (metrics.length > 0) {
    add("");
    add("Run summary:");
    metrics.forEach(add);
  }
  add(`elapsed time = ${formatNumber(elapsedMs / 1000)} seconds`);
  return lines.join("\n").trim();
}

function runSafely(fn) {
  write("Running...");
  setTimeout(() => {
    const started = performance.now();
    try {
      const text = fn();
      write(compactRunOutput(text, performance.now() - started));
    } catch (error) {
      write(`Error: ${error.message}`);
    }
  }, 30);
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    const panel = document.getElementById(button.dataset.panel);
    if (!panel) return;
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));
    button.classList.add("active");
    panel.classList.add("active");
  });
});

document.getElementById("clearOutput").addEventListener("click", () => write("Ready."));
document.getElementById("runSat").addEventListener("click", () => runSafely(() => run3SatCompressed(document.getElementById("satInput").value)));
document.getElementById("runVc").addEventListener("click", () => runSafely(() => runVertexCover(document.getElementById("vcInput").value)));
document.getElementById("runClique").addEventListener("click", () => runSafely(() => runClique(document.getElementById("cliqueInput").value)));
document.getElementById("runIs").addEventListener("click", () => runSafely(() => runIndependentSet(document.getElementById("isInput").value)));
document.getElementById("runSetCover").addEventListener("click", () => runSafely(() => runSetCover(document.getElementById("setCoverInput").value)));
document.getElementById("runX3c").addEventListener("click", () => runSafely(() => runX3c(document.getElementById("x3cInput").value)));
document.getElementById("runGraphColoring").addEventListener("click", () => runSafely(() => runGraphColoring(document.getElementById("graphColoringInput").value)));
if (document.getElementById("sudokuGrid")) {
  document.getElementById("buildSudokuGrid").addEventListener("click", () => runSafely(() => {
    buildSudokuGrid();
    return "Sudoku grid rebuilt.";
  }));
  document.getElementById("loadSudokuExample").addEventListener("click", () => runSafely(() => {
    loadSudokuExample();
    return "Loaded the 9x9 example.";
  }));
  document.getElementById("clearSudokuGrid").addEventListener("click", () => runSafely(() => {
    clearSudokuGrid();
    return "Sudoku grid cleared.";
  }));
  document.getElementById("runSudoku").addEventListener("click", () => runSafely(() => runSudoku()));
}
if (document.getElementById("packingCanvas")) {
  document.getElementById("addBoxType").addEventListener("click", () => addPackingBoxRow());
  document.getElementById("packingBoxRows").addEventListener("click", event => {
    if (!event.target.classList.contains("removeBoxType")) return;
    const rows = document.querySelectorAll("#packingBoxRows .boxRow");
    if (rows.length <= 1) {
      write("Keep at least one box type.");
      return;
    }
    event.target.closest(".boxRow").remove();
  });
  document.getElementById("runPacking3d").addEventListener("click", () => runSafely(() => runPacking3d()));
}
document.getElementById("runPairs").addEventListener("click", () => runSafely(() => {
  const { edge, n } = parsePairs(document.getElementById("pairsInput").value);
  return runTrackingSolver(edge, n, NaN, "browser pairs input", {
    hcNecessaryPrecheck: true,
    forceDegreeTwo: true,
    completeWithNeutralEdges: false,
    requireNonzeroFinalEdge: true,
    repairPasses: 0,
    backtrackLimit: getHcBacktrackTries(),
    stopAtFirstHamiltonian: shouldStopAtFirstHcTour(),
    tourKind: "hc",
    adaptiveBeta: true,
    betaMultiplier: 1,
    scoreMethod: "importance"
  });
}));
document.getElementById("runMatrix").addEventListener("click", () => runSafely(() => {
  const { edge, n } = parseMatrix(document.getElementById("matrixInput").value);
  return runTrackingSolver(edge, n, NaN, "browser matrix input", {
    repairPasses: getTspRepairPasses("matrixTspRepairPasses"),
    backtrackLimit: getHcBacktrackTries(),
    tourKind: "tsp",
    adaptiveBeta: true,
    betaMultiplier: 1,
    scoreMethod: "importance"
  });
}));
document.getElementById("runPoints").addEventListener("click", () => runSafely(() => {
  const { edge, n, points } = parsePoints(document.getElementById("pointsInput").value);
  return runTrackingSolver(edge, n, NaN, "browser points input", {
    scoreZeroEdges: true,
    euclideanPoints: points,
    removeEuclideanCrossings: true,
    repairPasses: getTspRepairPasses("pointsTspRepairPasses"),
    backtrackLimit: getHcBacktrackTries(),
    tourKind: "tsp",
    adaptiveBeta: true,
    betaMultiplier: 1,
    scoreMethod: "importance"
  });
}));
document.getElementById("runManual").addEventListener("click", () => runSafely(() => {
  const { edge, n } = parseManual(document.getElementById("manualInput").value);
  return runTrackingSolver(edge, n, NaN, "browser manual input", {
    repairPasses: getTspRepairPasses("manualTspRepairPasses"),
    backtrackLimit: getHcBacktrackTries(),
    tourKind: "tsp",
    adaptiveBeta: true,
    betaMultiplier: 1,
    scoreMethod: "importance"
  });
}));

document.getElementById("satFile").addEventListener("change", event => loadFileInto(event.target, "satInput"));
document.getElementById("vcFile").addEventListener("change", event => loadFileInto(event.target, "vcInput"));
document.getElementById("cliqueFile").addEventListener("change", event => loadFileInto(event.target, "cliqueInput"));
document.getElementById("isFile").addEventListener("change", event => loadFileInto(event.target, "isInput"));
document.getElementById("setCoverFile").addEventListener("change", event => loadFileInto(event.target, "setCoverInput"));
document.getElementById("x3cFile").addEventListener("change", event => loadFileInto(event.target, "x3cInput"));
document.getElementById("graphColoringFile").addEventListener("change", event => loadFileInto(event.target, "graphColoringInput"));
document.getElementById("pairsFile").addEventListener("change", event => loadFileInto(event.target, "pairsInput"));
document.getElementById("matrixFile").addEventListener("change", event => loadFileInto(event.target, "matrixInput"));
document.getElementById("pointsFile").addEventListener("change", event => loadFileInto(event.target, "pointsInput"));
document.getElementById("manualFile").addEventListener("change", event => loadFileInto(event.target, "manualInput"));

if (document.getElementById("sudokuGrid")) loadSudokuExample();
if (document.getElementById("packingCanvas")) drawPackingScene({ l: 20, w: 8, h: 8 }, []);
