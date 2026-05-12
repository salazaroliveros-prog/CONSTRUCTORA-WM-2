// src/lib/performanceLib.ts

// This library contains performance and cost data for various construction activities.
// In a real-world scenario, this would be fetched from a backend or a more comprehensive database.
// We'll export a function that, given an activity code or description, returns the parameters.
// For simplicity, we'll use a static map.

export interface PerformanceData {
  materialCost: number; // cost per unit of material (Q.)
  laborCost: number;    // cost per unit of labor (Q.)
  materialPerf: number; // units of material per unit of base quantity (e.g., kg/m²)
  laborPerf: number;    // units of labor per unit of base quantity (e.g., hr/m²)
}

// A sample library. In practice, this would be much larger and possibly loaded from a JSON file.
const performanceLibrary: Record<string, PerformanceData> = {
  // Example entries (to be expanded)
  '01-01-001': { // Estructuras - Cimentaciones
    materialCost: 150, // Q. per kg
    laborCost: 80,     // Q. per hour
    materialPerf: 0.5, // kg per m²
    laborPerf: 2.0,    // hr per m²
  },
  '01-02-001': { // Estructuras - Columnas
    materialCost: 200,
    laborCost: 90,
    materialPerf: 0.8,
    laborPerf: 2.5,
  },
  // ... more entries
};

/**
 * Get performance data for a given activity code.
 * If the code is not found, return a default set (or throw an error, depending on preference).
 * We'll return a default to avoid breaking the app, but in production you might want to handle missing data.
 */
export function getPerformanceData(code: string): PerformanceData {
  return performanceLibrary[code] || {
    materialCost: 100,
    laborCost: 50,
    materialPerf: 1.0,
    laborPerf: 1.0,
  };
}

/**
 * Optionally, we can also provide a function to get all codes for dropdowns.
 */
export function getAllActivityCodes(): string[] {
  return Object.keys(performanceLibrary);
}

// If we want to allow updating the library at runtime (e.g., from an admin panel), we could expose a setter.
// However, for now, we keep it static and assume updates are done by redeploying with a new library.
// In a more advanced system, this could be fetched from a backend.
