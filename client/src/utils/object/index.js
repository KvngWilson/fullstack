export function getNestedProperty(obj, path) {
  return path.split(".").reduce((current, prop) => current?.[prop], obj);
}

export function mergeUnique(arr1, arr2, key = "id") {
  const map = new Map();
  [...arr1, ...arr2].forEach((item) => {
    map.set(item[key], item);
  });
  return Array.from(map.values());
}

export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

export function sortBy(array, key, direction = "asc") {
  return [...array].sort((a, b) => {
    if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
    if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

export function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    ),
  );
}
