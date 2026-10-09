import * as THREE from 'three';
import { mesh, pastel, roundedBox } from '../core/cache';
import { haptic } from '../core/haptics';
import { blobShadow } from '../models/blob-shadow';
import type { CollisionWorld } from '../world/colliders';
import { STORE } from '../world/layout';
import type { InteractionSystem } from './interactions';
import type { Player } from './player';

const SIZE = 0.5;

/**
 * M2 test object for the context button (Pick up / Place) and carry pose.
 * Replaced by real delivery boxes in M4.
 */
export function createDemoCrate(
  scene: THREE.Scene,
  player: Player,
  interactions: InteractionSystem,
  world: CollisionWorld,
  start: THREE.Vector3,
): void {
  const crate = new THREE.Group();
  const box = mesh(roundedBox(SIZE, SIZE * 0.8, SIZE, 0.05), pastel('#d9a877', 0.85));
  box.position.y = SIZE * 0.4;
  const tape = mesh(roundedBox(SIZE * 0.22, SIZE * 0.81, SIZE * 1.01, 0.02), pastel('#f4e3c3', 0.6), { cast: false });
  tape.position.y = SIZE * 0.4;
  crate.add(box, tape);
  const shadow = blobShadow(0.8);

  let colliderId = 0;
  const placeAt = (p: THREE.Vector3): void => {
    crate.position.set(p.x, 0, p.z);
    crate.rotation.y = player.facing;
    scene.add(crate);
    shadow.position.set(p.x, 0.012, p.z);
    scene.add(shadow);
    colliderId = world.addCentered(p.x, p.z, SIZE * 0.9, SIZE * 0.9);
  };
  placeAt(start);

  // Pick up: lives where the crate rests.
  interactions.add({
    position: crate.position,
    radius: 0.3,
    label: () => (player.carried ? null : 'Pick up'),
    act: () => {
      world.remove(colliderId);
      shadow.removeFromParent();
      player.pickUp(crate);
      crate.position.set(0, -SIZE * 0.4, 0);
      haptic(20);
    },
  });

  // Place: follows the player while carrying.
  const placeSpot = new THREE.Vector3();
  interactions.add({
    position: placeSpot,
    radius: 5,
    label: () => {
      if (player.carried !== crate) return null;
      placeSpot.copy(player.frontPoint(0.75));
      return 'Place';
    },
    act: () => {
      const p = player.frontPoint(0.75);
      const m = 0.4;
      p.x = THREE.MathUtils.clamp(p.x, STORE.minX + m + 0.3, STORE.maxX - m);
      p.z = THREE.MathUtils.clamp(p.z, STORE.minZ + m, STORE.maxZ - m);
      player.drop();
      placeAt(p);
      haptic(12);
    },
  });
}
