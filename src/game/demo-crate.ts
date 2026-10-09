import * as THREE from 'three';
import { mesh, pastel, roundedBox } from '../core/cache';
import { haptic } from '../core/haptics';
import { blobShadow } from '../models/blob-shadow';
import type { CollisionWorld } from '../world/colliders';
import { STORE } from '../world/layout';
import { REACH, type InteractionSystem } from './interactions';
import type { Player } from './player';

const SIZE = 0.5;
const H = SIZE * 0.8;

/**
 * M2 test object for the context button (Pick up / Place) and carrying.
 * Replaced by real delivery boxes in M4.
 */
export function createDemoCrate(
  scene: THREE.Scene,
  player: Player,
  interactions: InteractionSystem,
  world: CollisionWorld,
  start: THREE.Vector3,
): { placeSpot: () => THREE.Vector3 | null } {
  const crate = new THREE.Group();
  const box = mesh(roundedBox(SIZE, H, SIZE, 0.05), pastel('#d9a877', 0.85));
  box.position.y = H / 2;
  const tape = mesh(roundedBox(SIZE * 0.22, H + 0.01, SIZE * 1.01, 0.02), pastel('#f4e3c3', 0.6), { cast: false });
  tape.position.y = H / 2;
  crate.add(box, tape);
  const shadow = blobShadow(0.8);

  let colliderId = 0;
  const placeAt = (p: THREE.Vector3, yaw: number): void => {
    crate.position.set(p.x, 0, p.z);
    crate.rotation.set(0, yaw, 0);
    scene.add(crate);
    shadow.position.set(p.x, 0.012, p.z);
    scene.add(shadow);
    colliderId = world.addCentered(p.x, p.z, SIZE * 0.9, SIZE * 0.9);
  };
  placeAt(start, 0.3);

  interactions.add({
    position: crate.position,
    radius: 0.32,
    aimHeight: H / 2,
    label: () => (player.carried ? null : 'Pick up'),
    act: () => {
      world.remove(colliderId);
      shadow.removeFromParent();
      // Carried relative to the camera; centre the box on the anchor.
      player.pickUp(crate);
      crate.position.y -= H / 2;
      haptic(20);
    },
  });

  /** Floor spot under the crosshair, kept inside the room and off the player. */
  const computeSpot = (): THREE.Vector3 => {
    const p = player.view.floorPoint(REACH);
    const m = 0.35;
    p.x = THREE.MathUtils.clamp(p.x, STORE.minX + m + 0.33, STORE.maxX - m);
    p.z = THREE.MathUtils.clamp(p.z, STORE.minZ + m, STORE.maxZ - m);
    const dx = p.x - player.position.x;
    const dz = p.z - player.position.z;
    const d = Math.hypot(dx, dz);
    const minD = 0.75;
    if (d < minD) {
      const yaw = player.yaw;
      const ux = d > 1e-3 ? dx / d : -Math.sin(yaw);
      const uz = d > 1e-3 ? dz / d : -Math.cos(yaw);
      p.x = player.position.x + ux * minD;
      p.z = player.position.z + uz * minD;
    }
    return p;
  };

  const spot = new THREE.Vector3();
  interactions.add({
    position: spot,
    radius: 50, // always "under the crosshair" while carrying
    label: () => {
      if (player.carried !== crate) return null;
      spot.copy(computeSpot());
      return 'Place';
    },
    act: () => {
      const p = computeSpot();
      player.drop();
      placeAt(p, player.yaw);
      haptic(12);
    },
  });

  return { placeSpot: () => (player.carried === crate ? spot : null) };
}
