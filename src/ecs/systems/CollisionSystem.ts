import { world } from '../world';
import { despawnProjectile } from '../../entities/Projectile';
import { spawnDeathParticles } from '../../entities/DeathParticles';
import { spawnDamageNumber } from '../../ui/DamageNumbers';
import { grantXP, getEnemyXP } from './XPSystem';
import { StatusType, hasStatus, consumeShock, applyStatus } from '../../core/StatusEffects';
import { rollDrops } from '../../loot/DropTable';
import { spawnItemDrop, spawnGoldDrop } from '../../entities/LootDrop';
import { hasModifier } from '../../core/MapDevice';
import { spawnMapDrop } from '../../entities/MapDrop';
import { spawnGemDrop } from '../../entities/GemDrop';
import { getComputedStats } from '../../core/ComputedStats';

/** Apply armor damage reduction to incoming damage. */
function reduceDamage(rawDamage: number): number {
  const dr = getComputedStats().damageReduction;
  return Math.max(1, Math.round(rawDamage * (1 - dr)));
}

const HIT_RADIUS = 16;
const CONTACT_RADIUS = 20;
const INVULN_DURATION = 1; // seconds

const projectiles = world.with('projectile', 'position', 'damage');
const enemyProjectiles = world.with('enemyProjectile', 'position', 'damage');
const enemies = world.with('enemy', 'position', 'health');
const enemiesWithDamage = world.with('enemy', 'position', 'damage');
const players = world.with('player', 'position', 'health');

/**
 * Checks projectile-enemy collisions using simple distance checks.
 * Deals damage and despawns projectiles on hit.
 * Removes enemies at zero health with death particles.
 * Also checks enemy-player contact damage with invulnerability window.
 * Called from fixedUpdate at 60 Hz.
 */
export function collisionSystem(dt: number): void {
  const projectilesToDespawn: typeof projectiles.entities[number][] = [];
  const enemiesToRemove: typeof enemies.entities[number][] = [];

  // --- Projectile vs Enemy ---
  for (const proj of projectiles) {
    let consumed = false;

    for (const enemy of enemies) {
      // Skip enemies already hit by this piercing projectile
      if (proj.piercing && proj.piercingHitIds?.has(enemy)) continue;

      const dx = proj.position.x - enemy.position.x;
      const dy = proj.position.y - enemy.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < HIT_RADIUS * HIT_RADIUS) {
        // Resist first hit modifier: enemy is immune to the first damage instance
        if (hasModifier('resist_first_hit') && !enemy.firstHitTaken) {
          world.addComponent(enemy, 'firstHitTaken', true as const);
          spawnDamageNumber(enemy.position.x, enemy.position.y - 10, 0, 0x888888);
          if (!proj.piercing) {
            consumed = true;
            projectilesToDespawn.push(proj);
          }
          continue;
        }

        // Calculate damage with status effect modifiers
        let dmg = proj.damage;

        // Shock: consumed on hit, +25% bonus damage
        if (consumeShock(enemy)) {
          dmg = Math.round(dmg * 1.25);
        }

        // Mark: +15% damage taken (not consumed)
        if (hasStatus(enemy, StatusType.Mark)) {
          dmg = Math.round(dmg * 1.15);
        }

        // Deal damage
        enemy.health.current -= dmg;
        spawnDamageNumber(enemy.position.x, enemy.position.y - 10, dmg, 0xffffff);

        // Apply knockback if projectile has knockbackOnHit
        if (proj.knockbackOnHit && proj.position) {
          applyStatus(enemy, StatusType.Knockback, proj.position);
        }

        // Flash effect on the enemy sprite
        if (enemy.sprite) {
          enemy.sprite.alpha = 0.3;
          setTimeout(() => {
            if (enemy.sprite) enemy.sprite.alpha = 1;
          }, 100);
        }

        if (enemy.health.current <= 0) {
          enemiesToRemove.push(enemy);
        }

        if (proj.piercing) {
          // Track this enemy so we don't double-hit
          proj.piercingHitIds?.add(enemy);
        } else {
          // Normal projectile: consumed on first hit
          consumed = true;
          projectilesToDespawn.push(proj);
          break;
        }
      }
    }

    if (consumed) continue;
  }

  for (const proj of projectilesToDespawn) {
    despawnProjectile(proj);
  }

  for (const enemy of enemiesToRemove) {
    // Spawn death particles before removing
    spawnDeathParticles(enemy.position.x, enemy.position.y);

    // Grant XP to player based on enemy type and level
    grantXP(getEnemyXP(enemy.enemyType ?? 'rusher', enemy.level ?? 1));

    // Roll and spawn loot/gold drops
    const enemyType = enemy.enemyType ?? 'rusher';
    const monsterLevel = enemy.level ?? 1;
    const drops = rollDrops(enemyType, monsterLevel);

    if (drops.gold > 0) {
      spawnGoldDrop(
        enemy.position.x + (Math.random() - 0.5) * 16,
        enemy.position.y + (Math.random() - 0.5) * 16,
        drops.gold,
      );
    }

    for (let i = 0; i < drops.items.length; i++) {
      // Spread items out slightly so they don't stack perfectly
      spawnItemDrop(
        enemy.position.x + (Math.random() - 0.5) * 24,
        enemy.position.y + (Math.random() - 0.5) * 24,
        drops.items[i],
      );
    }

    // Spawn map drop if rolled
    if (drops.mapItem) {
      spawnMapDrop(
        enemy.position.x + (Math.random() - 0.5) * 20,
        enemy.position.y + (Math.random() - 0.5) * 20,
        drops.mapItem,
      );
    }

    // Spawn gem drop if rolled
    if (drops.gem) {
      spawnGemDrop(
        enemy.position.x + (Math.random() - 0.5) * 20,
        enemy.position.y + (Math.random() - 0.5) * 20,
        drops.gem,
      );
    }

    // Explode on death modifier: deal AoE damage to the player
    if (hasModifier('explode_on_death')) {
      const explosionRadius = 60;
      const explosionDamage = Math.round((enemy.damage ?? 5) * 0.5);
      if (players.entities.length > 0) {
        const pl = players.entities[0];
        const edx = pl.position.x - enemy.position.x;
        const edy = pl.position.y - enemy.position.y;
        if (edx * edx + edy * edy < explosionRadius * explosionRadius) {
          const reducedExplosion = reduceDamage(explosionDamage);
          pl.health.current -= reducedExplosion;
          spawnDamageNumber(pl.position.x, pl.position.y - 10, reducedExplosion, 0xff6600);
        }
      }
    }

    if (enemy.sprite) {
      enemy.sprite.removeFromParent();
    }
    world.remove(enemy);
  }

  // --- Enemy vs Player contact damage ---
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  // Tick down invulnerability timer
  if (player.invulnTimer !== undefined && player.invulnTimer > 0) {
    player.invulnTimer -= dt;

    // Flash the player sprite during invulnerability
    if (player.sprite) {
      player.sprite.alpha = Math.sin(player.invulnTimer * 20) > 0 ? 0.3 : 1;
    }

    if (player.invulnTimer <= 0) {
      player.invulnTimer = 0;
      if (player.sprite) player.sprite.alpha = 1;
    }
    return; // Skip contact checks while invulnerable
  }

  for (const enemy of enemiesWithDamage) {
    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < CONTACT_RADIUS * CONTACT_RADIUS) {
      const reducedContactDmg = reduceDamage(enemy.damage);
      player.health.current -= reducedContactDmg;
      spawnDamageNumber(player.position.x, player.position.y - 10, reducedContactDmg, 0xff3333);
      world.addComponent(player, 'invulnTimer', INVULN_DURATION);

      // Fire enchanted modifier: enemies apply Burn on contact
      if (hasModifier('fire_enchanted')) {
        applyStatus(player, StatusType.Burn, enemy.position);
      }

      if (player.health.current <= 0) {
        player.health.current = 0;
        // Player death handling can be added later
      }

      break; // Only one hit per frame
    }
  }

  // --- Enemy Projectile vs Player ---
  const enemyProjsToDespawn: typeof enemyProjectiles.entities[number][] = [];
  for (const proj of enemyProjectiles) {
    const dx = proj.position.x - player.position.x;
    const dy = proj.position.y - player.position.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < HIT_RADIUS * HIT_RADIUS) {
      const reducedProjDmg = reduceDamage(proj.damage);
      player.health.current -= reducedProjDmg;
      spawnDamageNumber(player.position.x, player.position.y - 10, reducedProjDmg, 0xff44ff);

      if (player.health.current <= 0) {
        player.health.current = 0;
      }

      enemyProjsToDespawn.push(proj);
    }
  }

  for (const proj of enemyProjsToDespawn) {
    despawnProjectile(proj);
  }
}
