"use strict";

const output = document.getElementById("output");

function write(text) {
  output.textContent = text;
}

function append(lines, text = "") {
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

function pairProductFromSumAndSquares(sum, squareSum) {
  return ((sum * sum) - squareSum) * 0.5;
}

function collectAvailableVertices(endpointLink, n) {
  const values = [];
  for (let i = 1; i <= n; i++) if (endpointLink[i] !== -1) values.push(i);
  return values;
}

function accumulateRemainingEdgeBuckets(availableVertices, endpointLink, edge, edgeSquared) {
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

function accumulateVarianceBuckets(availableVertices, endpointLink, edge, buckets) {
  const vertexCapacity = endpointLink.length;
  const activeFreeByActive = Array(vertexCapacity).fill(0);
  const activeFreeSquareByActive = Array(vertexCapacity).fill(0);
  const activeFreeByFree = Array(vertexCapacity).fill(0);
  const activeFreeSquareByFree = Array(vertexCapacity).fill(0);
  const freeFreeByFree = Array(vertexCapacity).fill(0);
  const freeFreeSquareByFree = Array(vertexCapacity).fill(0);
  const activeActiveByActive = Array(vertexCapacity).fill(0);
  const activeActiveEdges = [];

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
        if (weight !== 0) activeActiveEdges.push({ from, to, fromLink, toLink, weight });
      }
    }
  }

  let activeFreeSameActivePairSum = 0;
  let activeFreeSameFreePairSum = 0;
  let activeFreeMateSameFreePairSum = 0;
  let freeFreeTouchingPairSum = 0;
  let activeFreeFreeTouchingPairSum = 0;
  let mixedOpenSharedActivePairSum = 0;
  for (const vertex of availableVertices) {
    activeFreeSameActivePairSum += pairProductFromSumAndSquares(activeFreeByActive[vertex], activeFreeSquareByActive[vertex]);
    activeFreeSameFreePairSum += pairProductFromSumAndSquares(activeFreeByFree[vertex], activeFreeSquareByFree[vertex]);
    freeFreeTouchingPairSum += pairProductFromSumAndSquares(freeFreeByFree[vertex], freeFreeSquareByFree[vertex]);
    activeFreeFreeTouchingPairSum += activeFreeByFree[vertex] * freeFreeByFree[vertex];
    mixedOpenSharedActivePairSum += activeActiveByActive[vertex] * activeFreeByActive[vertex];
  }

  for (const free of availableVertices) {
    if (endpointLink[free] !== 0) continue;
    for (const active of availableVertices) {
      const mate = endpointLink[active];
      if (mate <= active || mate >= vertexCapacity || endpointLink[mate] !== active) continue;
      activeFreeMateSameFreePairSum += edge[active][free] * edge[mate][free];
    }
  }

  const activeFreePairSum = pairProductFromSumAndSquares(buckets.activeFreeSum, buckets.activeFreeSquareSum);
  const freeFreePairSum = pairProductFromSumAndSquares(buckets.freeFreeSum, buckets.freeFreeSquareSum);
  buckets.activeFreeTouchingPairSum += activeFreeSameFreePairSum - activeFreeMateSameFreePairSum;
  buckets.activeFreeDisjointPairSum += activeFreePairSum - activeFreeSameActivePairSum - activeFreeSameFreePairSum;
  buckets.freeFreeTouchingPairSum += freeFreeTouchingPairSum;
  buckets.freeFreeDisjointPairSum += freeFreePairSum - freeFreeTouchingPairSum;
  buckets.mixedOpenTouchingPairSum += (buckets.activeActiveOpenSum * buckets.activeFreeSum) - mixedOpenSharedActivePairSum;
  buckets.mixedOpenFreePairSum += buckets.activeActiveOpenSum * buckets.freeFreeSum;
  buckets.activeFreeFreeTouchingPairSum += activeFreeFreeTouchingPairSum;
  buckets.activeFreeFreeDisjointPairSum += (buckets.activeFreeSum * buckets.freeFreeSum) - activeFreeFreeTouchingPairSum;

  for (let firstIndex = 0; firstIndex < activeActiveEdges.length; firstIndex++) {
    const first = activeActiveEdges[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < activeActiveEdges.length; secondIndex++) {
      const second = activeActiveEdges[secondIndex];
      const c = first.from, g = first.to, p = second.from, k = second.to;
      const cLink = first.fromLink, gLink = first.toLink;
      const pLink = second.fromLink, kLink = second.toLink;

      if ((cLink !== 0 && (k === c || p === c)) ||
          (gLink !== 0 && (k === g || p === g))) continue;
      if ((kLink !== 0 && (k === c || k === g)) ||
          (pLink !== 0 && (p === c || p === g))) continue;
      if ((cLink === p && g === k) || (cLink === k && g === p) ||
          (gLink === p && c === k) || (gLink === k && c === p)) continue;
      if ((kLink === c && g === p) || (kLink === g && c === p) ||
          (pLink === c && g === k) || (pLink === g && c === k)) continue;
      if ((cLink === p && gLink === k) || (cLink === k && gLink === p)) continue;

      const product = first.weight * second.weight;
      buckets.activeActiveOpenPairSum += product;
    }
  }
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

function computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state) {
  const availableVertices = collectAvailableVertices(endpointLink, n);
  const buckets = accumulateRemainingEdgeBuckets(availableVertices, endpointLink, edge, edgeSquared);
  const mean = computeConditionedMeanTourLength(n, endpointLink, state, edge, buckets);
  accumulateVarianceBuckets(availableVertices, endpointLink, edge, buckets);
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

function adaptiveBetaForState(n, edge, edgeSquared, endpointLink, state, multiplier) {
  const stats = computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state);
  const beta = stats.variance > 1e-12 ? multiplier / Math.sqrt(stats.variance) : null;
  return { beta, stats };
}

function computeLogZFromStats(stats, beta) {
  return stats.entropy - (beta * stats.mean) + ((beta * beta) * 0.5 * stats.variance);
}

function computeTheoryScore(n, edge, edgeSquared, endpointLink, state, beta) {
  const stats = computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state);
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

function collectCandidateEdges(n, edge, endpointLink, state, candidateEdgeKeys = null) {
  const candidateEdges = [];
  if (candidateEdgeKeys) {
    for (const key of candidateEdgeKeys) {
      const [from, to] = key.split(":").map(Number);
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

function rankScoringEdges(n, edge, edgeSquared, endpointLink, state, beta, candidateEdgeKeys = null, options = {}) {
  const ranked = [];
  const scoreMethod = options.scoreMethod === "importance" ? "importance" : "omega";
  const currentStats = scoreMethod === "importance"
    ? computeConditionedStateStats(n, edge, edgeSquared, endpointLink, state)
    : null;
  const candidateEdges = collectCandidateEdges(n, edge, endpointLink, state, candidateEdgeKeys);
  for (const candidate of candidateEdges) {
    const trialLinks = endpointLink.slice();
    const trialState = { ...state, chosenEdges: null };
    if (!applyChosenEdge(candidate.from, candidate.to, edge, trialLinks, trialState)) continue;
    const classInfo = candidateClassInfo(endpointLink, candidate.from, candidate.to);
    const plusStats = computeConditionedStateStats(n, edge, edgeSquared, trialLinks, trialState);
    const plusLogZ = computeLogZFromStats(plusStats, beta);
    let logScore = plusLogZ;
    let importanceInfo = null;
    if (scoreMethod === "importance") {
      importanceInfo = computeImportanceScore(currentStats, plusStats, beta);
      if (!importanceInfo) continue;
      logScore = importanceInfo.importance;
    }
    if (Number.isNaN(logScore) || logScore === -Infinity) continue;
    ranked.push({
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
    });
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
  const ranked = rankScoringEdges(n, edge, edgeSquared, endpointLink, state, beta, candidateEdgeKeys, options);
  const best = ranked[0];
  if (best) return best;
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

function cloneSolverState(state) {
  return {
    ...state,
    chosenEdges: state.chosenEdges ? state.chosenEdges.slice() : []
  };
}

function remainingChoices(n, state) {
  return n - state.usedVertices + state.closedChains - 1;
}

function resolveStepBeta(n, edge, edgeSquared, endpointLink, state, options, lastAdaptiveBeta) {
  if (!options.adaptiveBeta) return { beta: options.effectiveBeta, lastAdaptiveBeta, standardDeviation: null };
  const current = adaptiveBetaForState(n, edge, edgeSquared, endpointLink, state, options.betaMultiplier);
  let nextBeta = lastAdaptiveBeta;
  if (current.beta !== null && Number.isFinite(current.beta)) nextBeta = current.beta;
  return {
    beta: nextBeta,
    lastAdaptiveBeta: nextBeta,
    standardDeviation: current.stats.standardDeviation
  };
}

function finishTourFromState(edge, n, endpointLink, state, options) {
  const lines = [];
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
    append(lines, `The biggest probability is 1 at Edge[${forced.from}][${forced.to}].`);
    totalTourCost += forced.weight;
    if (state.chosenEdges) state.chosenEdges.push({ from: forced.from, to: forced.to, weight: forced.weight });
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
      if (repair.totalTourCost < totalTourCost) totalTourCost = repair.totalTourCost;
    } else {
      append(lines, `repair skipped = ${repair.reason}`);
    }
  }

  return {
    lines,
    totalTourCost,
    hamiltonianFound: Math.abs(totalTourCost + n) < 1e-9
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
  return alternatives;
}

function runScoreGuidedBacktracking(edge, n, edgeSquared, rootEndpointLink, rootState, searchOptions) {
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

  while (queue.length > 0 && explored < maxTries) {
    queue.sort((a, b) => a.penalty - b.penalty);
    const branch = queue.shift();
    explored += 1;
    let guard = 0;
    let stoppedBecause = "completed";

    while (remainingChoices(n, branch.state) > 0) {
      const betaInfo = resolveStepBeta(n, edge, edgeSquared, branch.endpointLink, branch.state, searchOptions, branch.lastAdaptiveBeta);
      branch.lastAdaptiveBeta = betaInfo.lastAdaptiveBeta;
      if (searchOptions.adaptiveBeta && branch.trace.lines.length < 80) {
        appendTraceLine(branch.trace, `current standard deviation = ${formatNumber(betaInfo.standardDeviation)} adaptive beta = ${formatNumber(betaInfo.beta)}`);
      }

      const ranked = rankScoringEdges(n, edge, edgeSquared, branch.endpointLink, branch.state, betaInfo.beta, null, searchOptions);
      if (ranked.length === 0) {
        stoppedBecause = "no scored candidate edges";
        break;
      }

      const best = ranked[0];
      const alternatives = selectSmartBacktrackAlternatives(ranked, alternativesPerSplit, searchOptions);
      for (const alternativeInfo of alternatives) {
        const alternative = alternativeInfo.candidate;
        const altEndpointLink = branch.endpointLink.slice();
        const altState = cloneSolverState(branch.state);
        if (!applyChosenEdge(alternative.from, alternative.to, edge, altEndpointLink, altState)) continue;
        if (searchOptions.forceDegreeTwo) propagateDegreeTwoForcedEdges(edge, n, altEndpointLink, altState);
        const regret = alternativeInfo.regret;
        const altTrace = {
          lines: branch.trace.lines.slice(),
          omitted: branch.trace.omitted
        };
        appendTraceLine(altTrace, `backtrack choice: Edge[${alternative.from}][${alternative.to}] ${formatCandidateChoice(alternative)} regret ${formatNumber(regret)}`);
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

      appendTraceLine(branch.trace, `chosen edge: Edge[${best.from}][${best.to}] ${formatCandidateChoice(best)} omega ${formatNumber(best.omega)} log-omega ${formatNumber(best.logOmega)}`);
      if (!applyChosenEdge(best.from, best.to, edge, branch.endpointLink, branch.state)) {
        stoppedBecause = "chosen edge became invalid";
        break;
      }
      if (searchOptions.forceDegreeTwo) {
        const forcedAfterChoice = propagateDegreeTwoForcedEdges(edge, n, branch.endpointLink, branch.state);
        if (forcedAfterChoice.forcedEdgeCount > 0) {
          appendTraceLine(branch.trace, `Degree-2 propagation forced ${forcedAfterChoice.forcedEdgeCount} edges.`);
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
    if (!bestFinal ||
        (candidate.hamiltonianFound && !bestFinal.hamiltonianFound) ||
        (candidate.hamiltonianFound === bestFinal.hamiltonianFound &&
         candidate.totalTourCost < bestFinal.totalTourCost)) {
      bestFinal = candidate;
    }
    if (candidate.hamiltonianFound) break;
  }

  const lines = [];
  append(lines, "Score-guided backtracking:");
  append(lines, `backtrack try limit = ${maxTries}`);
  append(lines, `requested backtrack tries = ${requestedTries}`);
  append(lines, `polynomial branch cap = ${polynomialBranchCap}`);
  append(lines, `branches explored = ${explored}`);
  append(lines, `branches queued = ${queued}`);
  append(lines, `smart alternatives per split cap = ${alternativesPerSplit}`);
  append(lines, `smart backtrack log tolerance = ${formatNumber(searchOptions.smartBacktrackLogTolerance ?? 1e-9)}`);
  append(lines, `best branch penalty = ${formatNumber(bestFinal ? bestFinal.penalty : 0)}`);
  append(lines, `best branch stopped because = ${bestFinal ? bestFinal.stoppedBecause : "none"}`);
  if (bestFinal) {
    append(lines, "Best branch trace:");
    bestFinal.trace.lines.forEach(line => append(lines, line));
    if (bestFinal.trace.omitted > 0) append(lines, `... ${bestFinal.trace.omitted} trace lines omitted ...`);
    append(lines, bestFinal.lines.join("\n"));
    return {
      lines,
      totalTourCost: bestFinal.totalTourCost,
      partialTourCost: bestFinal.totalTourCost,
      hamiltonianFound: bestFinal.hamiltonianFound
    };
  }
  append(lines, "No branch was completed.");
  return { lines, totalTourCost: NaN, partialTourCost: NaN, hamiltonianFound: false };
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

function solveTrackingSolver(edge, n, beta, sourceLabel, options = {}) {
  if (n < 2) throw new Error("Need at least 2 vertices.");
  const lines = [];
  const edgeSquared = buildSquaredEdgeMatrix(edge, n);
  const moments = computeTheoryMoments(edge, edgeSquared, n);
  const effectiveBeta = Number.isFinite(beta) ? beta : (1.0 / Math.sqrt(Math.max(Number.MIN_VALUE, moments.tourVariance)));
  const adaptiveBeta = Boolean(options.adaptiveBeta);
  const betaMultiplier = Number.isFinite(options.betaMultiplier) ? options.betaMultiplier : effectiveBeta;
  const scoreMethod = options.scoreMethod === "importance" ? "importance" : "omega";
  append(lines, `Source: ${sourceLabel}`);
  append(lines, `n = ${n}`);
  append(lines, `the average  = ${formatNumber(moments.meanTourLength)}`);
  append(lines, `S_self ${formatNumber(moments.selfInteractionSum)} S_neighbor ${formatNumber(moments.neighborInteractionSum)} S_non_neighbor ${formatNumber(moments.disjointInteractionSum)}`);
  append(lines, `the standard deviation = ${formatNumber(moments.tourVariance)} ${formatNumber(Math.sqrt(Math.max(0, moments.tourVariance)))}`);
  append(lines, `suggested beta value = ${formatNumber(1.0 / Math.sqrt(Math.max(Number.MIN_VALUE, moments.tourVariance)))}`);
  append(lines, `adaptive beta = ${adaptiveBeta ? "on" : "off"}`);
  append(lines, `score method = ${scoreMethod === "importance" ? "importance lnZ(force edge) - lnZ(forbid edge)" : "omega lnZ(force edge)"}`);
  const entropy = lnGamma(n) - Math.log(2.0);
  const partition = entropy - (effectiveBeta * moments.meanTourLength) + ((effectiveBeta * effectiveBeta) * 0.5 * moments.tourVariance);
  append(lines, `entropy ${formatNumber(entropy)} partition ${formatNumber(partition)}`);

  const endpointLink = Array(n + 1).fill(0);
  const state = { closedChains: 0, usedVertices: 0, chosenEdgeTotal: 0, chosenEdges: [] };
  if (options.allowedEdgeKeys) state.allowedEdgeKeys = options.allowedEdgeKeys;
  state.scoreZeroEdges = Boolean(options.scoreZeroEdges);
  let propagationAfterChoiceCount = 0;
  let propagationAfterChoiceEdges = 0;
  if (options.forceDegreeTwo) {
    const forced = propagateDegreeTwoForcedEdges(edge, n, endpointLink, state);
    append(lines, "Degree-2 forced-edge precheck:");
    append(lines, `vertices with exactly two edges applied = ${forced.forcedVertexCount}`);
    append(lines, `forced edges applied = ${forced.forcedEdgeCount}`);
    append(lines, `forced propagation passes = ${forced.passes}`);
    append(lines, `forced edge total = ${formatNumber(forced.forcedEdgeTotal)}`);
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
      text: lines.join("\n"),
      totalTourCost: search.totalTourCost,
      partialTourCost: search.partialTourCost,
      hamiltonianFound: search.hamiltonianFound,
      moments
    };
  }
  let totalTourCost = state.chosenEdgeTotal;
  let guard = 0;
  let lastAdaptiveBeta = effectiveBeta;
  while (n - state.usedVertices + state.closedChains - 1 > 0) {
    let stepBeta = effectiveBeta;
    if (adaptiveBeta) {
      const current = adaptiveBetaForState(n, edge, edgeSquared, endpointLink, state, betaMultiplier);
      if (current.beta !== null && Number.isFinite(current.beta)) lastAdaptiveBeta = current.beta;
      stepBeta = lastAdaptiveBeta;
      append(lines, `current standard deviation = ${formatNumber(current.stats.standardDeviation)} adaptive beta = ${formatNumber(stepBeta)}`);
    }
    const best = findBestScoringEdge(n, edge, edgeSquared, endpointLink, state, stepBeta, null, options);
    if (!best.from) break;
    append(lines, `The biggest probability is ${formatNumber(best.probability)} at Edge[${best.from}][${best.to}].`);
    if (best.scoreMethod === "importance") {
      append(lines, `Importance score = ${formatNumber(best.importance)} from plus lnZ ${formatNumber(best.plusLogZ)} minus lnZ ${formatNumber(best.minusLogZ)}; normalized by omega = ${formatNumber(best.omega)} and log-omega = ${formatNumber(best.logOmega)}.`);
    } else {
      append(lines, `Taylor log-score = ${formatNumber(best.logScore)} normalized by omega = ${formatNumber(best.omega)} and log-omega = ${formatNumber(best.logOmega)}.`);
    }
    if (best.className) append(lines, `Edge class = ${best.className}.`);
    if (!applyChosenEdge(best.from, best.to, edge, endpointLink, state)) break;
    if (options.forceDegreeTwo) {
      const forcedAfterChoice = propagateDegreeTwoForcedEdges(edge, n, endpointLink, state);
      if (forcedAfterChoice.forcedEdgeCount > 0) {
        propagationAfterChoiceCount += 1;
        propagationAfterChoiceEdges += forcedAfterChoice.forcedEdgeCount;
        append(lines, `Degree-2 propagation after choice forced ${forcedAfterChoice.forcedEdgeCount} edges in ${forcedAfterChoice.passes} passes.`);
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
    text: lines.join("\n"),
    totalTourCost,
    hamiltonianFound,
    moments
  };
}

function runTrackingSolver(edge, n, beta, sourceLabel, options = {}) {
  return solveTrackingSolver(edge, n, beta, sourceLabel, options).text;
}

function getHcSolveNodeLimit() {
  const input = document.getElementById("hcSolveNodeLimit");
  if (!input) return Infinity;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("HC solve node limit must be a nonnegative number.");
  return Math.floor(value);
}

function getHcBetaMultiplier() {
  const input = document.getElementById("hcBetaMultiplier");
  if (!input) return 1;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) throw new Error("HC beta multiplier must be greater than 0.");
  return value;
}

function getHcScoreMethod() {
  const input = document.getElementById("hcScoreMethod");
  if (!input) return "importance";
  return input.value === "omega" ? "omega" : "importance";
}

function getHcAdaptiveBeta() {
  const input = document.getElementById("hcAdaptiveBeta");
  return input ? input.checked : false;
}

function getHcRepairPasses() {
  const input = document.getElementById("hcRepairPasses");
  if (!input) return 0;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("HC repair passes must be a nonnegative number.");
  return Math.floor(value);
}

function getHcBacktrackTries() {
  const input = document.getElementById("hcBacktrackTries");
  if (!input) return 0;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("HC backtrack tries must be a nonnegative number.");
  return Math.floor(value);
}

function runCompressedHcDecision(graph, sourceLabel) {
  const limit = getHcSolveNodeLimit();
  if (graph.n > limit) {
    const lines = [];
    append(lines, "NP-douce HC solver result:");
    append(lines, `HC solver not run because ${graph.n} nodes is above the HC solve node limit ${limit}.`);
    append(lines, "Raise the HC solve node limit if you want to force this reduced HC instance through the solver.");
    return { text: "", summary: lines.join("\n"), totalTourCost: NaN, hamiltonianFound: false, notComputed: true };
  }
  const baseEdgeSquared = buildSquaredEdgeMatrix(graph.edge, graph.n);
  const baseMoments = computeTheoryMoments(graph.edge, baseEdgeSquared, graph.n);
  const suggestedBeta = 1.0 / Math.sqrt(Math.max(Number.MIN_VALUE, baseMoments.tourVariance));
  const multiplier = getHcBetaMultiplier();
  const beta = suggestedBeta * multiplier;
  const result = solveTrackingSolver(graph.edge, graph.n, beta, `${sourceLabel} beta x${formatNumber(multiplier)}`, {
    forceDegreeTwo: true,
    allowedEdgeKeys: graph.allowedEdgeKeys || null,
    repairPasses: getHcRepairPasses(),
    backtrackLimit: getHcBacktrackTries(),
    completeWithNeutralEdges: true,
    adaptiveBeta: getHcAdaptiveBeta(),
    betaMultiplier: multiplier,
    scoreMethod: getHcScoreMethod()
  });
  const lines = [];
  append(lines, "NP-douce HC solver result:");
  if (graph.allowedEdgeKeys) append(lines, `allowed HC edges scored = ${graph.allowedEdgeKeys.size}`);
  append(lines, `HC beta multiplier = x${formatNumber(multiplier)}`);
  append(lines, `HC score method = ${getHcScoreMethod()}`);
  append(lines, `HC adaptive beta = ${getHcAdaptiveBeta() ? "on" : "off"}`);
  append(lines, `HC backtrack tries = ${getHcBacktrackTries()}`);
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
  append(lines);
  append(lines, "HC solver trace:");
  append(lines, result.text);
  return { ...result, summary: lines.join("\n"), notComputed: false };
}

function inferredAnswerLine(hc, label, yesText = "YES", noText = "NO") {
  if (hc.notComputed) return `${label} answer inferred from HC: NOT COMPUTED`;
  return hc.hamiltonianFound ? `${label} answer inferred from HC: ${yesText}` : `${label} answer inferred from HC: ${noText}`;
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
  return { edge, n };
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
  const add = (from, to) => {
    edge[from][to] = -1;
    edge[to][from] = -1;
    allowedEdgeKeys.add(edgeKey(from, to));
  };
  add(1, 2);
  add(2, 3);
  add(3, 1);
  return {
    edge,
    n: 3,
    allowedEdgeKeys,
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
  const decisionEdgeKeys = new Set();

  const add = (from, to, decision = false) => {
    if (from === to) return;
    edge[from][to] = -1;
    edge[to][from] = -1;
    const key = edgeKey(from, to);
    allowedEdgeKeys.add(key);
    if (decision) decisionEdgeKeys.add(key);
  };

  for (const gadget of gadgetRows) {
    for (let i = 0; i < 5; i++) {
      add(gadget.uRow[i], gadget.uRow[i + 1]);
      add(gadget.vRow[i], gadget.vRow[i + 1]);
    }
    add(gadget.uRow[0], gadget.vRow[2], true);
    add(gadget.vRow[0], gadget.uRow[2], true);
    add(gadget.uRow[5], gadget.vRow[3], true);
    add(gadget.uRow[3], gadget.vRow[5], true);
  }

  const vertexPaths = [];
  for (let vertex = 1; vertex <= vertexCount; vertex++) {
    const rows = incidentRows[vertex].sort((a, b) => a.edgeIndex - b.edgeIndex);
    if (rows.length === 0) continue;
    for (let index = 0; index + 1 < rows.length; index++) {
      add(rows[index].end, rows[index + 1].start, true);
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

  return {
    edge,
    n: totalNodes,
    allowedEdgeKeys,
    decisionEdgeKeys,
    gadgetCount: normalizedEdges.length,
    selectorSlots,
    selectors,
    paddingNodes: paddingNodes.length,
    vertexPaths,
    normalizedEdges
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

function appendDirectVertexCoverHcReduction(lines, graph, sourceLabel, answerLabel, yesText = "YES", noText = "NO") {
  append(lines);
  append(lines, "Direct Vertex Cover -> Hamiltonian Cycle reduction size:");
  append(lines, `edge gadgets = ${graph.gadgetCount}`);
  append(lines, `12-node gadget vertices = ${12 * graph.gadgetCount}`);
  append(lines, `selector slots = ${graph.selectorSlots}`);
  append(lines, `padding nodes = ${graph.paddingNodes || 0}`);
  append(lines, `undirected HC nodes = ${graph.n}`);
  append(lines, `allowed HC edges = ${graph.allowedEdgeKeys ? graph.allowedEdgeKeys.size : 0}`);
  if (graph.decisionEdgeKeys) append(lines, `decision-style edges = ${graph.decisionEdgeKeys.size}`);

  const forced = findDegreeTwoForcedEdges(graph.edge, graph.n);
  append(lines);
  append(lines, "Degree-2 forced-edge precheck:");
  append(lines, `vertices with exactly two HC edges = ${forced.forcedVertexCount}`);
  append(lines, `forced HC edges = ${forced.forcedEdgeCount}`);
  append(lines, `forced edge total = ${formatNumber(forced.forcedEdgeTotal)}`);

  const hc = runCompressedHcDecision(graph, sourceLabel);
  append(lines);
  append(lines, hc.summary);
  append(lines);
  append(lines, inferredAnswerLine(hc, answerLabel, yesText, noText));
  return hc;
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
  const add = (u, v) => {
    if (u === v) return;
    edges.push([u, v]);
  };
  const positiveVertex = variable => (2 * variable) - 1;
  const negativeVertex = variable => 2 * variable;
  const literalVertex = literal => literal > 0 ? positiveVertex(literal) : negativeVertex(-literal);

  for (let variable = 1; variable <= variableCount; variable++) {
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
    n: (2 * variableCount) + (3 * clauses.length),
    k: variableCount + (2 * clauses.length),
    padding,
    edges,
    variableCount,
    clauseCount: clauses.length
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
  return { simplified, vertexCover, graph, stats, skipped: false };
}

function appendSatViaVertexCoverHcReduction(lines, prepared, sourceLabel, answerLabel, yesText = "YES", noText = "NO") {
  append(lines);
  appendSatSimplificationSummary(lines, prepared.simplified);
  if (prepared.simplified.contradiction) {
    append(lines);
    append(lines, "NP-douce HC solver result:");
    append(lines, "HC solver skipped because exact unit propagation already proved the reduced SAT formula impossible.");
    append(lines);
    append(lines, `${answerLabel} answer after exact unit simplification: ${noText}`);
    return { text: "", summary: "", totalTourCost: NaN, hamiltonianFound: false, notComputed: true };
  }

  append(lines);
  append(lines, "Classic 3-SAT -> Vertex Cover size:");
  append(lines, `SAT variables sent to Vertex Cover = ${prepared.stats.variableCount}`);
  append(lines, `SAT clauses sent to Vertex Cover = ${prepared.stats.clauseCount}`);
  append(lines, `Vertex Cover vertices = ${prepared.stats.vertexCoverVertices}`);
  append(lines, `Vertex Cover edges = ${prepared.stats.vertexCoverEdges}`);
  append(lines, `Vertex Cover target k = ${prepared.stats.vertexCoverTarget}`);
  append(lines, `estimated HC nodes after Vertex Cover gadget = ${prepared.stats.hcNodes}`);

  if (prepared.skipped) {
    append(lines);
    append(lines, "NP-douce HC solver result:");
    append(lines, `HC solver not run because ${prepared.skipReason}.`);
    append(lines, "Raise the HC solve node limit if you want to force this reduced HC instance through the solver.");
    append(lines);
    append(lines, `${answerLabel} answer inferred from HC: NOT COMPUTED`);
    return { text: "", summary: "", totalTourCost: NaN, hamiltonianFound: false, notComputed: true };
  }

  return appendDirectVertexCoverHcReduction(lines, prepared.graph, sourceLabel, answerLabel, yesText, noText);
}

function runVertexCover(text) {
  const { n, k, padding, edges } = parseVertexCover(text);
  const graph = buildDirectVertexCoverHcGraph(n, k, edges, padding);

  const lines = [];
  append(lines, "Vertex Cover instance:");
  append(lines, `vertices = ${n}`);
  append(lines, `edges = ${edges.length}`);
  append(lines, `k = ${k}`);
  append(lines, `optional padding nodes = ${padding}`);
  append(lines, `edge list = ${edges.map(([u, v]) => `(${u},${v})`).join(" ")}`);
  append(lines);
  append(lines, "Reduction used:");
  append(lines, "Vertex Cover(G, k) -> direct 12-node edge gadgets -> Hamiltonian Cycle");
  append(lines, "Gadget crosses: u1-v3, v1-u3, u6-v4, u4-v6.");
  appendDirectVertexCoverHcReduction(lines, graph, "Vertex Cover direct HC reduction", "Vertex Cover");
  return lines.join("\n");
}

function runClique(text) {
  const { n, k, padding, edges } = parseClique(text);
  const complementEdges = buildComplementEdges(n, edges);
  const vertexCoverK = n - k;
  const graph = vertexCoverK >= 0 ? buildDirectVertexCoverHcGraph(n, vertexCoverK, complementEdges, padding) : null;

  const lines = [];
  append(lines, "Clique instance:");
  append(lines, `vertices = ${n}`);
  append(lines, `edges = ${edges.length}`);
  append(lines, `k = ${k}`);
  append(lines, `optional padding nodes = ${padding}`);
  append(lines, `edge list = ${edges.map(([u, v]) => `(${u},${v})`).join(" ") || "(none)"}`);
  append(lines);
  append(lines, "Reduction used:");
  append(lines, "Clique(G, k) -> Vertex Cover(complement(G), vertices - k) -> direct 12-node edge gadgets -> Hamiltonian Cycle");
  append(lines, `complement graph edges = ${complementEdges.length}`);
  append(lines, `vertex cover target on complement = ${vertexCoverK}`);

  if (!graph) {
    append(lines);
    append(lines, "Clique answer: NO");
    append(lines, `k = ${k} is larger than the vertex count ${n}`);
    return lines.join("\n");
  }

  appendDirectVertexCoverHcReduction(lines, graph, "Clique via direct Vertex Cover HC reduction", "Clique");
  return lines.join("\n");
}

function runIndependentSet(text) {
  const { n, k, padding, edges } = parseIndependentSet(text);
  const vertexCoverK = n - k;
  const graph = vertexCoverK >= 0 ? buildDirectVertexCoverHcGraph(n, vertexCoverK, edges, padding) : null;

  const lines = [];
  append(lines, "Independent Set instance:");
  append(lines, `vertices = ${n}`);
  append(lines, `edges = ${edges.length}`);
  append(lines, `k = ${k}`);
  append(lines, `optional padding nodes = ${padding}`);
  append(lines, `edge list = ${edges.map(([u, v]) => `(${u},${v})`).join(" ") || "(none)"}`);
  append(lines);
  append(lines, "Reduction used:");
  append(lines, "Independent Set(G, k) -> Vertex Cover(G, vertices - k) -> direct 12-node edge gadgets -> Hamiltonian Cycle");
  append(lines, `vertex cover target = ${vertexCoverK}`);

  if (!graph) {
    append(lines);
    append(lines, "Independent Set answer: NO");
    append(lines, `k = ${k} is larger than the vertex count ${n}`);
    return lines.join("\n");
  }

  appendDirectVertexCoverHcReduction(lines, graph, "Independent Set via direct Vertex Cover HC reduction", "Independent Set");
  return lines.join("\n");
}

function runSetCover(text) {
  const { universeSize, setCount, k, padding, sets } = parseSetCover(text);
  const sat = setCoverTo3Sat(universeSize, setCount, k, sets);
  const prepared = prepareSatViaVertexCoverForHc(sat, padding);

  const lines = [];
  append(lines, "Set Cover instance:");
  append(lines, `universe elements = ${universeSize}`);
  append(lines, `sets = ${setCount}`);
  append(lines, `k = ${k}`);
  append(lines, `optional padding nodes = ${padding}`);
  append(lines, "sets:");
  sets.forEach((set, index) => append(lines, `S${index + 1} = { ${set.join(", ")} }`));
  append(lines);
  append(lines, "Reduction used:");
  append(lines, "Set Cover -> 3-SAT coverage clauses plus at-most-k -> classic Vertex Cover -> direct Hamiltonian Cycle");
  append(lines, `one Boolean variable per set before auxiliary variables = ${setCount}`);
  append(lines);
  append(lines, "3-SAT encoding:");
  append(lines, `cardinality encoding = ${sat.encoding}`);
  append(lines, `CNF clauses before 3-literal normalization = ${sat.rawClauseCount}`);
  append(lines, `variables before simplification = ${sat.variableCount}`);
  append(lines, `3-SAT clauses before simplification = ${sat.clauses.length}`);
  appendSatViaVertexCoverHcReduction(lines, prepared, "Set Cover via 3-SAT -> Vertex Cover -> direct HC", "Set Cover");
  return lines.join("\n");
}

function runX3c(text) {
  const { universeSize, setCount, padding, sets } = parseX3c(text);
  const sat = x3cTo3Sat(universeSize, setCount, sets);
  const prepared = prepareSatViaVertexCoverForHc(sat, padding);
  const targetSetCount = universeSize % 3 === 0 ? universeSize / 3 : "not integral";

  const lines = [];
  append(lines, "X3C instance:");
  append(lines, `universe elements = ${universeSize}`);
  append(lines, `3-sets = ${setCount}`);
  append(lines, `target selected sets = ${targetSetCount}`);
  append(lines, `optional padding nodes = ${padding}`);
  append(lines, "sets:");
  sets.forEach((set, index) => append(lines, `S${index + 1} = { ${set.join(", ")} }`));
  append(lines);
  append(lines, "Reduction used:");
  append(lines, "X3C -> 3-SAT exactly-once coverage clauses -> classic Vertex Cover -> direct Hamiltonian Cycle");
  append(lines, `one Boolean variable per 3-set before auxiliary variables = ${setCount}`);
  append(lines);
  append(lines, "3-SAT encoding:");
  append(lines, `encoding = ${sat.encoding}`);
  append(lines, `CNF clauses before 3-literal normalization = ${sat.rawClauseCount}`);
  append(lines, `variables before simplification = ${sat.variableCount}`);
  append(lines, `3-SAT clauses before simplification = ${sat.clauses.length}`);
  appendSatViaVertexCoverHcReduction(lines, prepared, "X3C via 3-SAT -> Vertex Cover -> direct HC", "X3C");
  return lines.join("\n");
}

function graphColorName(index) {
  const names = ["", "red", "green", "blue", "yellow", "purple", "orange", "cyan", "magenta", "gray"];
  return names[index] || `color${index}`;
}

function runGraphColoring(text) {
  const { n, declaredEdgeCount, colorCount, padding, edges } = parseGraphColoring(text);
  const sat = graphColoringTo3Sat(n, colorCount, edges);
  const prepared = prepareSatViaVertexCoverForHc(sat, padding);

  const lines = [];
  append(lines, "Graph Coloring instance:");
  append(lines, `vertices = ${n}`);
  append(lines, `declared edges = ${declaredEdgeCount}`);
  append(lines, `unique edges used = ${edges.length}`);
  append(lines, `colors requested = ${colorCount}`);
  append(lines, `optional padding nodes = ${padding}`);
  append(lines, `edge list = ${edges.map(([u, v]) => `(${u},${v})`).join(" ") || "(none)"}`);
  append(lines);
  append(lines, "Reduction used:");
  append(lines, "Graph Coloring -> 3-SAT color clauses -> classic Vertex Cover -> direct Hamiltonian Cycle");
  append(lines, `${colorCount} Boolean color variables per vertex`);
  append(lines);
  append(lines, "3-SAT encoding:");
  append(lines, `encoding = ${sat.encoding}`);
  append(lines, `CNF clauses before 3-literal normalization = ${sat.rawClauseCount}`);
  append(lines, `variables before simplification = ${sat.variableCount}`);
  append(lines, `3-SAT clauses before simplification = ${sat.clauses.length}`);
  appendSatViaVertexCoverHcReduction(lines, prepared, "Graph Coloring via 3-SAT -> Vertex Cover -> direct HC", "Graph Coloring");
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
  let hc = null;
  let solution = null;
  const lines = [];
  append(lines, "Sudoku instance:");
  append(lines, `grid = ${puzzle.n} x ${puzzle.n}`);
  append(lines, `box shape = ${puzzle.boxSize} x ${puzzle.boxSize}`);
  append(lines, `allowed values = 1 through ${puzzle.n}`);
  append(lines, `givens = ${puzzle.givens}`);
  append(lines);
  append(lines, "Original puzzle:");
  append(lines, formatSudokuGrid(puzzle.grid, puzzle.symbols));
  append(lines);
  append(lines, "Exact Sudoku reduction:");
  append(lines, "Sudoku -> exact cover style 3-SAT -> classic Vertex Cover -> direct Hamiltonian Cycle");
  append(lines, `base placement variables = ${sat.baseVariableCount}`);
  append(lines, `SAT variables before simplification = ${sat.variableCount}`);
  append(lines, `CNF clauses before 3-literal normalization = ${sat.rawClauseCount}`);
  append(lines, `3-SAT clauses before simplification = ${compactMode ? sat.clauses.length : sat.clauseCount}`);
  if (!compactMode) append(lines, "Large Sudoku mode: clauses are counted exactly without materializing the full clause list in memory.");
  append(lines);
  if (compactMode) {
    appendSatSimplificationSummary(lines, prepared.simplified);
  } else {
    append(lines, "Exact unit-clause simplification before HC:");
    append(lines, "not materialized for 25x25 mode, because building the full clause list would be too much memory for a browser or phone");
  }
  append(lines);
  if (compactMode && prepared.simplified.contradiction) {
    append(lines, "NP-douce HC solver result:");
    append(lines, "HC solver skipped because exact unit propagation already proved the Sudoku constraints impossible.");
    append(lines, "Sudoku answer inferred from HC: NO SOLUTION");
  } else {
    append(lines, "Classic 3-SAT -> Vertex Cover size:");
    append(lines, `SAT variables sent to Vertex Cover = ${stats.variableCount}`);
    append(lines, `SAT clauses sent to Vertex Cover = ${stats.clauseCount}`);
    append(lines, `Vertex Cover vertices = ${stats.vertexCoverVertices}`);
    append(lines, `Vertex Cover edges = ${stats.vertexCoverEdges}`);
    append(lines, `Vertex Cover target k = ${stats.vertexCoverTarget}`);
    append(lines, `estimated HC nodes after Vertex Cover gadget = ${stats.hcNodes}`);
  }
  append(lines);
  if (compactMode && !prepared.simplified.contradiction && !prepared.skipped) {
    hc = appendDirectVertexCoverHcReduction(lines, prepared.graph, "Sudoku via 3-SAT -> Vertex Cover -> direct HC", "Sudoku", "SOLUTION EXISTS", "NO SOLUTION");
    if (hc.hamiltonianFound) {
      solution = solveSudokuPuzzle(puzzle);
      if (solution) {
        applySudokuSolution(puzzle, solution);
        append(lines);
        append(lines, "Visual witness filled after HC returned YES:");
        append(lines, formatSudokuGrid(solution, puzzle.symbols));
      }
    }
  } else if (!compactMode || !prepared.simplified.contradiction) {
    append(lines, "NP-douce HC solver result:");
    append(lines, `HC solver not run because ${stats.hcNodes} nodes is above the safety limit ${denseLimit}${compactMode ? "" : " or the Sudoku is in 25x25 large mode"}.`);
    append(lines, "Sudoku answer inferred from HC: NOT COMPUTED");
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

function formatPackingPlacement(box) {
  const endX = box.x + box.l;
  const endY = box.y + box.w;
  const endZ = box.z + box.h;
  return `${box.id}: position (${formatNumber(box.x)}, ${formatNumber(box.y)}, ${formatNumber(box.z)}) -> (${formatNumber(endX)}, ${formatNumber(endY)}, ${formatNumber(endZ)}), size ${formatNumber(box.l)} x ${formatNumber(box.w)} x ${formatNumber(box.h)}, weight ${formatNumber(box.weight)}`;
}

function runPacking3d() {
  const input = readPackingInput();
  const packed = packBoxesExtremePoint(input);
  drawPackingScene(input.truck, packed.placed);
  const reduction = buildPackingCandidateReduction(input, packed);
  const prepared = prepareSatViaVertexCoverForHc(reduction, 0);
  const truckVolume = input.truck.l * input.truck.w * input.truck.h;
  const totalBoxVolume = packed.items.reduce((sum, item) => sum + item.volume, 0);
  const totalBoxWeight = packed.items.reduce((sum, item) => sum + item.weight, 0);
  const lines = [];
  append(lines, "3D Packing instance:");
  append(lines, `truck = ${input.truck.l} x ${input.truck.w} x ${input.truck.h}`);
  append(lines, `truck volume = ${formatNumber(truckVolume)}`);
  append(lines, `max weight = ${formatNumber(input.truck.maxWeight)}`);
  append(lines, `box types = ${input.types.length}`);
  append(lines, `physical boxes = ${packed.items.length}`);
  append(lines, `total box volume = ${formatNumber(totalBoxVolume)}`);
  append(lines, `total box weight = ${formatNumber(totalBoxWeight)}`);
  append(lines);
  append(lines, "Practical packing answer:");
  append(lines, `packed boxes = ${packed.placed.length}`);
  append(lines, `unpacked boxes = ${packed.unpacked.length}`);
  append(lines, `used volume = ${formatNumber(packed.usedVolume)} (${formatNumber((packed.usedVolume / truckVolume) * 100)}%)`);
  append(lines, `loaded weight = ${formatNumber(packed.totalWeight)}`);
  if (packed.unpacked.length) append(lines, `unpacked list = ${packed.unpacked.map(item => item.id).join(", ")}`);
  append(lines);
  append(lines, "Box placement manifest:");
  append(lines, "Coordinates are (length, width, height). The first coordinate is the lower-back-left corner; the second is the upper-front-right corner.");
  packed.placed
    .slice()
    .sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x || a.name.localeCompare(b.name) || a.copy - b.copy)
    .forEach((box, index) => append(lines, `${index + 1}. ${formatPackingPlacement(box)}`));
  if (packed.unpacked.length) {
    append(lines);
    append(lines, "Unpacked manifest:");
    packed.unpacked.forEach((item, index) => {
      append(lines, `${index + 1}. ${item.id}: original size ${formatNumber(item.l)} x ${formatNumber(item.w)} x ${formatNumber(item.h)}, weight ${formatNumber(item.weight)}`);
    });
  }
  append(lines);
  append(lines, "Candidate-placement reduction:");
  append(lines, "Each candidate means one exact box orientation at one generated position. Clauses choose one placement per box and reject overlaps.");
  append(lines, "Candidate 3-SAT -> classic Vertex Cover -> direct Hamiltonian Cycle.");
  append(lines, `max packing options sent to HC = ${input.candidateBudget}`);
  append(lines, `generated candidates = ${reduction.generatedCandidates}`);
  append(lines, `kept candidates = ${reduction.keptCandidates}${reduction.pruned ? " (pruned for low nodes)" : ""}`);
  append(lines, `SAT variables before simplification = ${reduction.variableCount}`);
  append(lines, `CNF clauses before 3-literal normalization = ${reduction.rawClauseCount}`);
  append(lines, `3-SAT clauses before simplification = ${reduction.clauses.length}`);
  if (reduction.impossibleReasons.length) append(lines, `necessary impossibility check = ${reduction.impossibleReasons.join("; ")}`);
  appendSatViaVertexCoverHcReduction(lines, prepared, "3D packing via 3-SAT -> Vertex Cover -> direct HC", "Packing candidate model");
  append(lines, "The manifest above is a visual/practical placement guide; the YES/NO line comes from the HC solver.");
  append(lines, "Higher max packing options send more possibilities into HC, creating more nodes and slower runs.");
  return lines.join("\n");
}

function literalText(literal) {
  return literal < 0 ? `~x${-literal}` : `x${literal}`;
}

function formatFormula(clauses) {
  return clauses.map(clause => `(${clause.map(literalText).join(" OR ")})`).join(" AND ");
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

function forcedAssignmentText(assignment) {
  const values = [];
  for (let variable = 1; variable < assignment.length; variable++) {
    if (assignment[variable] === 1) values.push(`x${variable}=true`);
    if (assignment[variable] === -1) values.push(`x${variable}=false`);
  }
  return values.join(", ") || "(none)";
}

function appendSatSimplificationSummary(lines, simplified) {
  append(lines, "Exact unit-clause simplification before HC:");
  append(lines, `unit-forced assignments = ${simplified.forcedAssignments}`);
  append(lines, `forced values = ${forcedAssignmentText(simplified.assignment)}`);
  append(lines, `clauses removed as satisfied = ${simplified.satisfiedClauses}`);
  append(lines, `tautology clauses removed = ${simplified.tautologyClauses}`);
  append(lines, `clauses left after unit propagation = ${simplified.simplifiedClauseCount}`);
  append(lines, `binary clauses kept without duplicate gadget ports = ${simplified.binaryExpandedClauses}`);
  append(lines, `auxiliary variables added by simplification = ${simplified.auxiliaryVariablesAdded}`);
  append(lines, `3-SAT clauses sent to HC = ${simplified.finalClauseCount}`);
  if (simplified.contradiction) append(lines, `contradiction = ${simplified.contradictionReason}`);
}

function run3SatCompressed(text) {
  const { variableCount, clauseCount, padding, clauses } = parse3Sat(text);
  const prepared = prepareSatViaVertexCoverForHc({ variableCount, clauses }, padding);
  const lines = [];
  append(lines, "3-SAT instance:");
  append(lines, `variables = ${variableCount}`);
  append(lines, `clauses = ${clauseCount}`);
  append(lines, `optional padding nodes = ${padding}`);
  append(lines, `Formula: ${formatFormula(clauses)}`);
  append(lines);
  append(lines, "Reduction used:");
  append(lines, "3-SAT -> classic Vertex Cover clause triangles -> direct Hamiltonian Cycle");
  appendSatViaVertexCoverHcReduction(lines, prepared, "3-SAT via classic Vertex Cover HC reduction", "Original 3-SAT", "SATISFIABLE", "UNSATISFIABLE");
  return lines.join("\n");
}

function findDegreeTwoForcedEdges(edge, n) {
  const forcedEdge = new Set();
  let forcedEdgeCount = 0;
  let forcedVertexCount = 0;
  let forcedEdgeTotal = 0;

  for (let vertex = 1; vertex <= n; vertex++) {
    const neighbors = [];
    for (let neighbor = 1; neighbor <= n; neighbor++) {
      if (vertex !== neighbor && edge[vertex][neighbor] !== 0) neighbors.push(neighbor);
    }
    if (neighbors.length !== 2) continue;

    forcedVertexCount += 1;
    for (const neighbor of neighbors) {
      const a = Math.min(vertex, neighbor);
      const b = Math.max(vertex, neighbor);
      const key = `${a}:${b}`;
      if (forcedEdge.has(key)) continue;
      forcedEdge.add(key);
      forcedEdgeCount += 1;
      forcedEdgeTotal += edge[vertex][neighbor];
    }
  }

  return { forcedVertexCount, forcedEdgeCount, forcedEdgeTotal };
}

async function loadFileInto(fileInput, textareaId) {
  const file = fileInput.files[0];
  if (!file) return;
  document.getElementById(textareaId).value = await file.text();
}

function runSafely(fn) {
  write("Running...");
  setTimeout(() => {
    try {
      write(fn());
    } catch (error) {
      write(`Error: ${error.message}`);
    }
  }, 30);
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.panel).classList.add("active");
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
document.getElementById("buildSudokuGrid").addEventListener("click", () => runSafely(() => {
  buildSudokuGrid();
  return "Sudoku grid rebuilt.";
}));
document.getElementById("loadSudokuExample").addEventListener("click", () => runSafely(() => {
  loadSudokuExample();
  return "Loaded the 9x9 Sudoku example.";
}));
document.getElementById("clearSudokuGrid").addEventListener("click", () => runSafely(() => {
  clearSudokuGrid();
  return "Sudoku grid cleared.";
}));
document.getElementById("runSudoku").addEventListener("click", () => runSafely(() => runSudoku()));
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
document.getElementById("runPairs").addEventListener("click", () => runSafely(() => {
  const { edge, n } = parsePairs(document.getElementById("pairsInput").value);
  return runTrackingSolver(edge, n, Number(document.getElementById("pairsBeta").value), "browser pairs input", {
    forceDegreeTwo: true,
    completeWithNeutralEdges: true,
    repairPasses: getHcRepairPasses(),
    backtrackLimit: getHcBacktrackTries(),
    scoreMethod: getHcScoreMethod()
  });
}));
document.getElementById("runMatrix").addEventListener("click", () => runSafely(() => {
  const { edge, n } = parseMatrix(document.getElementById("matrixInput").value);
  return runTrackingSolver(edge, n, Number(document.getElementById("matrixBeta").value), "browser matrix input", {
    repairPasses: getHcRepairPasses(),
    backtrackLimit: getHcBacktrackTries(),
    scoreMethod: getHcScoreMethod()
  });
}));
document.getElementById("runPoints").addEventListener("click", () => runSafely(() => {
  const { edge, n } = parsePoints(document.getElementById("pointsInput").value);
  return runTrackingSolver(edge, n, Number(document.getElementById("pointsBeta").value), "browser points input", {
    scoreZeroEdges: true,
    repairPasses: getHcRepairPasses(),
    backtrackLimit: getHcBacktrackTries(),
    scoreMethod: getHcScoreMethod()
  });
}));
document.getElementById("runManual").addEventListener("click", () => runSafely(() => {
  const { edge, n } = parseManual(document.getElementById("manualInput").value);
  return runTrackingSolver(edge, n, Number(document.getElementById("manualBeta").value), "browser manual input", {
    repairPasses: getHcRepairPasses(),
    backtrackLimit: getHcBacktrackTries(),
    scoreMethod: getHcScoreMethod()
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

loadSudokuExample();
drawPackingScene({ l: 20, w: 8, h: 8 }, []);
