import { CollisionWorld } from './colliders';
import { PLANT_SPOTS, SHOP_WINDOW, STORE } from './layout';

/** Static collision for the shell: walls, front rim, window ledge, plants. */
export function buildStoreColliders(): CollisionWorld {
  const world = new CollisionWorld();
  const { minX, maxX, minZ, maxZ } = STORE;
  const t = 1; // generous thickness so fast movement can't tunnel
  world.add({ minX: minX - t, maxX: maxX + t, minZ: minZ - t, maxZ: minZ });
  world.add({ minX: minX - t, maxX: maxX + t, minZ: maxZ, maxZ: maxZ + t });
  world.add({ minX: minX - t, maxX: minX, minZ: minZ - t, maxZ: maxZ + t });
  world.add({ minX: maxX, maxX: maxX + t, minZ: minZ - t, maxZ: maxZ + t });
  // Interior window ledge.
  world.add({ minX, maxX: minX + 0.33, minZ: SHOP_WINDOW.zMin - 0.1, maxZ: SHOP_WINDOW.zMax + 0.1 });
  for (const [x, z, s] of PLANT_SPOTS) world.addCentered(x, z, 0.6 * s, 0.6 * s);
  return world;
}
