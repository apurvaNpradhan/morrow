import { membersShapes } from "#api/members/index";
import { projectsShapes } from "#api/projects/index";
import { tasksShapes } from "#api/tasks/index";
import { workspaceShapes } from "#api/workspace/index";
import type { ShapeDefinition } from "./define-shape";

/** Every shape the browser may ask for, by name. A vertical adds its shapes here. */
function buildRegistry(shapes: ShapeDefinition[]) {
  const registry = new Map<string, ShapeDefinition>();
  for (const shape of shapes) {
    if (registry.has(shape.name)) {
      throw new Error(`Two shapes are named "${shape.name}"`);
    }
    registry.set(shape.name, shape);
  }
  return registry;
}

export const shapeRegistry = buildRegistry([
  ...membersShapes,
  ...projectsShapes,
  ...tasksShapes,
  ...workspaceShapes,
]);
