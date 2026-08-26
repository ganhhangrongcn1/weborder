function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function movementKey(documentId = "", itemId = "") {
  return `${toText(documentId)}:${toText(itemId)}`;
}

export function buildInventorySalesCostRows({
  events = [],
  movements = [],
  recipes = [],
  productionOrders = []
} = {}) {
  const recipeById = new Map(recipes.map((recipe) => [toText(recipe.id), recipe]));
  const movementTotals = new Map();

  movements.forEach((movement) => {
    if (toText(movement.direction) !== "out") return;
    const key = movementKey(movement.documentId, movement.itemId);
    const current = movementTotals.get(key) || { quantity: 0, value: 0, movements: [] };
    const quantity = Math.abs(toNumber(movement.quantity));
    current.quantity += quantity;
    current.value += quantity * Math.max(0, toNumber(movement.unitCost));
    current.movements.push(movement);
    movementTotals.set(key, current);
  });

  const originsByItem = new Map();
  productionOrders.forEach((order) => {
    const itemId = toText(order.outputItemId);
    if (!itemId || toText(order.status) !== "completed") return;
    if (!originsByItem.has(itemId)) originsByItem.set(itemId, []);
    originsByItem.get(itemId).push(order);
  });
  originsByItem.forEach((rows) => rows.sort((left, right) => toText(right.completedAt).localeCompare(toText(left.completedAt))));

  return events.map((event) => {
    const componentLines = (event.lines || []).filter((line) => line.itemId && line.recipeId && line.lineStatus !== "ignored");
    const components = componentLines.map((line) => {
      const movement = movementTotals.get(movementKey(event.documentId, line.itemId)) || { quantity: 0, value: 0, movements: [] };
      const unitCost = movement.quantity > 0 ? movement.value / movement.quantity : 0;
      const requiredQuantity = Math.max(0, toNumber(line.requiredQuantity));
      const recipe = recipeById.get(toText(line.recipeId)) || {};
      const origin = (originsByItem.get(toText(line.itemId)) || []).find(
        (order) => !event.occurredAt || !order.completedAt || order.completedAt <= event.occurredAt
      ) || null;
      return {
        id: toText(line.id),
        sourceLineKey: toText(line.sourceLineKey),
        dishName: toText(line.sourceLineName || line.menuEntityName),
        menuEntityName: toText(line.menuEntityName),
        itemId: toText(line.itemId),
        recipeId: toText(line.recipeId),
        recipeCode: toText(recipe.code),
        recipeVersion: toNumber(recipe.version || 1),
        requiredQuantity,
        unitCost,
        lineCost: requiredQuantity * unitCost,
        movementCount: movement.movements.length,
        origin
      };
    });
    const actualCost = components.reduce((sum, line) => sum + line.lineCost, 0);
    const dishNames = [...new Set(components.map((line) => line.dishName).filter(Boolean))];
    const recipeVersions = [...new Set(components.map((line) => line.recipeCode
      ? `${line.recipeCode} · v${line.recipeVersion}`
      : `Phiên bản ${line.recipeVersion}`).filter(Boolean))];

    return {
      ...event,
      components,
      actualCost,
      dishNames,
      recipeVersions,
      traceComplete: Boolean(event.documentId)
        && components.length > 0
        && components.every((line) => line.movementCount > 0 && line.recipeId)
    };
  });
}

export function buildInventoryProductionVarianceRows(productionOrders = []) {
  return productionOrders
    .filter((order) => toText(order.status) === "completed")
    .map((order) => {
      const estimatedCost = Math.max(0, toNumber(order.estimatedTotalCost));
      const actualCost = Math.max(0, toNumber(order.actualTotalCost));
      const variance = actualCost - estimatedCost;
      const varianceRate = estimatedCost > 0 ? variance / estimatedCost * 100 : 0;
      const plannedInput = (order.lines || []).reduce((sum, line) => sum + Math.max(0, toNumber(line.plannedBaseQuantity)), 0);
      const actualInput = (order.lines || []).reduce((sum, line) => sum + Math.max(0, toNumber(line.actualBaseQuantity)), 0);

      return {
        ...order,
        estimatedCost,
        actualCost,
        variance,
        varianceRate,
        plannedInput,
        actualInput,
        inputVariance: actualInput - plannedInput
      };
    });
}

export function calculateInventoryCostAnalysisSummary({ salesRows = [], productionRows = [] } = {}) {
  return {
    salesOrderCount: salesRows.length,
    salesCost: salesRows.reduce((sum, row) => sum + toNumber(row.actualCost), 0),
    traceCompleteCount: salesRows.filter((row) => row.traceComplete).length,
    productionOrderCount: productionRows.length,
    productionVariance: productionRows.reduce((sum, row) => sum + toNumber(row.variance), 0)
  };
}

export default {
  buildInventoryProductionVarianceRows,
  buildInventorySalesCostRows,
  calculateInventoryCostAnalysisSummary
};
