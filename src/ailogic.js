/**
 * aiLogic.js
 * Contains the Mathematical Models for the Agro-Guard AI.
 */

// --- FEATURE 1: PREDICTIVE INVENTORY (Linear Regression) ---
export const predictEmptyTime = (history) => {
  if (history.length < 5) return "Gathering Data...";

  const n = history.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  history.forEach(point => {
    sumX += point.x;
    sumY += point.y;
    sumXY += (point.x * point.y);
    sumXX += (point.x * point.x);
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  if (slope >= 0) return "Stable / Filling"; // Not emptying

  const predictedTimeSeconds = -intercept / slope;
  const now = Date.now() / 1000;
  const secondsRemaining = predictedTimeSeconds - history[history.length - 1].x;
  
  if (secondsRemaining <= 0) return "Empty Imminent";
  if (secondsRemaining > 86400 * 30) return "Stable (> 30 Days)";

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  
  return `${hours}h ${minutes}m`;
};

// --- FEATURE 2: ANOMALY DETECTION (Z-Score Statistics) ---
export const detectAnomaly = (currentValue, history) => {
  if (history.length < 10) return false; // Need baseline data

  // Calculate Mean
  const values = history.map(h => h.val);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  // Calculate Standard Deviation
  const squareDiffs = values.map(value => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(avgSquareDiff);

  // If variance is tiny, ignore (avoids false alarms on stable data)
  if (stdDev < 0.5) return false; 

  // Check Z-Score (3 Sigma Rule)
  const zScore = Math.abs((currentValue - mean) / stdDev);
  return zScore > 3; // True if anomaly
};