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
import { getDamageReduction } from '../../core/ComputedStats';
import { spawnMiniSplitter } from '../../entities/Enemy';
import { sfxPlayer } from '../../audio/SFXManager';
import { spawnHitSparks } from '../../entities/HitSparks';
import { shake } from './CameraSystem';
import { game } from '../../Game';
import { Graphics } from 'pixi.js';

/** Apply armor damage reduction to incoming damage, scaled by monster level. */
function reduceDamage(rawDamage: number, monsterLevel = 1): number {
  const dr = getDamageReduction(monsterLevel);
  return Math.max(1, Math.round(rawDamage * (1 - dr)));
}

/** Threshold for "heavy damage" screen shake (20% of max HP). */
const HEAVY_DMG_RATIO = 0.2;

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
        // Shielder: block projectiles hitting the front face
        if (enemy.shielded && enemy.sprite) {
          // Enemy facing angle (toward player, set by AISystem rotation)
          const facingAngle = enemy.sprite.rotation;
          // Projectile incoming angle (from projectile toward enemy)
          const incomingAngle = Math.atan2(
            enemy.position.y - proj.position.y,
            enemy.position.x - proj.position.x,
          );
          // Angle difference between enemy facing and projectile incoming direction
          let angleDiff = facingAngle - incomingAngle;
          // Normalize to [-PI, PI]
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          // Block if projectile comes from within ~90 degrees of the front face
          if (Math.abs(angleDiff) < Math.PI / 2) {
            // Blocked by shield - show "0" damage and consume projectile
            spawnDamageNumber(enemy.position.x, enemy.position.y - 10, 0, 0x4488ff);
            if (!proj.piercing) {
              consumed = true;
              projectilesToDespawn.push(proj);
            }
            continue;
          }
        }

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
        spawnHitSparks(enemy.position.x, enemy.position.y, 'physical');
        sfxPlayer.play('hit_physical');

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
    // Splitter: spawn 2 mini-splitters on death (only if not already a mini-splitter)
    if (enemy.enemyType === 'splitter' && !enemy.isMiniSplitter) {
      for (let i = 0; i < 2; i++) {
        const offsetX = (i === 0 ? -1 : 1) * 16;
        const offsetY = (Math.random() - 0.5) * 16;
        spawnMiniSplitter(
          enemy.position.x + offsetX,
          enemy.position.y + offsetY,
          enemy.level ?? 1,
        );
      }
    }

    // Spawn death particles before removing
    spawnDeathParticles(enemy.position.x, enemy.position.y);
    sfxPlayer.play('enemy_death');

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

    // Volatile modifier: AoE explosion on death (15% of enemy max HP, 64px radius)
    if (hasModifier('explode_on_death')) {
      const explosionRadius = 64;
      const explosionDamage = Math.round(enemy.health.max * 0.15);
      // Spawn orange particle burst at death position
      spawnExplosionParticles(enemy.position.x, enemy.position.y);
      if (players.entities.length > 0) {
        const pl = players.entities[0];
        const edx = pl.position.x - enemy.position.x;
        const edy = pl.position.y - enemy.position.y;
        if (edx * edx + edy * edy < explosionRadius * explosionRadius) {
          const reducedExplosion = reduceDamage(explosionDamage, enemy.level ?? 1);
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
      const reducedContactDmg = reduceDamage(enemy.damage, enemy.level ?? 1);
      player.health.current -= reducedContactDmg;
      spawnDamageNumber(player.position.x, player.position.y - 10, reducedContactDmg, 0xff3333);
      spawnHitSparks(player.position.x, player.position.y, 'physical');
      sfxPlayer.play('hit_physical');
      world.addComponent(player, 'invulnTimer', INVULN_DURATION);

      // Screen shake on heavy damage (>20% max HP)
      if (player.health.max > 0 && reducedContactDmg / player.health.max >= HEAVY_DMG_RATIO) {
        shake(0.3, 6);
      }

      // Boss contact: always shake
      if (enemy.boss) {
        shake(0.4, 8);
      }

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
      const reducedProjDmg = reduceDamage(proj.damage, proj.level ?? 1);
      player.health.current -= reducedProjDmg;
      spawnDamageNumber(player.position.x, player.position.y - 10, reducedProjDmg, 0xff44ff);
      spawnHitSparks(player.position.x, player.position.y, 'fire');
      sfxPlayer.play('hit_magic');

      // Screen shake on heavy projectile damage (>20% max HP)
      if (player.health.max > 0 && reducedProjDmg / player.health.max >= HEAVY_DMG_RATIO) {
        shake(0.3, 6);
      }

      // Fire enchanted modifier: enemy projectiles apply Burn
      if (hasModifier('fire_enchanted')) {
        applyStatus(player, StatusType.Burn, proj.position);
      }

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

// ── Volatile explosion particle burst ─────────────────────────────────
const EXPLOSION_PARTICLE_COUNT = 10;
const EXPLOSION_PARTICLE_SPEED = 120;
const EXPLOSION_PARTICLE_DURATION = 400; // ms
const EXPLOSION_PARTICLE_COLOR = 0xff6600;

function spawnExplosionParticles(x: number, y: number): void {
  for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
    const g = new Graphics();
    g.circle(0, 0, 4).fill({ color: EXPLOSION_PARTICLE_COLOR });
    g.position.set(x, y);
    game.effectLayer.addChild(g);

    const angle = (Math.PI * 2 * i) / EXPLOSION_PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
    const speed = EXPLOSION_PARTICLE_SPEED * (0.6 + Math.random() * 0.4);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / EXPLOSION_PARTICLE_DURATION, 1);
      g.position.x += vx * (1 / 60);
      g.position.y += vy * (1 / 60);
      g.alpha = 1 - t;
      if (t >= 1) {
        g.removeFromParent();
        g.destroy();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }
}
