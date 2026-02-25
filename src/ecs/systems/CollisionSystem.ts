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
import { spawnMiniSplitter, recordCorpse } from '../../entities/Enemy';
import { sfxPlayer } from '../../audio/SFXManager';
import { spawnHitSparks } from '../../entities/HitSparks';
import { shake } from './CameraSystem';
import { game } from '../../Game';
import { Graphics } from 'pixi.js';
import { hasEffect, activateFrenzy, isFrenzyActive } from '../../core/UniqueEffects';
import { fireProjectile } from '../../entities/Projectile';
import {
  trackDamageTaken,
  trackKill,
  trackMultiHit,
  getEquippedConditionalValue,
  getStatusOnTargetDamageBonus,
} from '../../core/ConditionalAffixSystem';
import { skillSystem } from '../../core/SkillSystem';

/** Overcharger death buff constants */
const OVERCHARGER_BUFF_RADIUS = 160;
const OVERCHARGER_BUFF_DURATION = 5;
const OVERCHARGER_BUFF_DAMAGE_MULT = 0.25;
const OVERCHARGER_BUFF_SPEED_MULT = 0.15;

/** Mirror reflect cooldown */
const MIRROR_REFLECT_COOLDOWN = 2;

/** Apply armor damage reduction to incoming damage, scaled by monster level. */
function reduceDamage(rawDamage: number, monsterLevel = 1): number {
  const dr = getDamageReduction(monsterLevel);
  return Math.max(1, Math.round(rawDamage * (1 - dr)));
}

/** Threshold for "heavy damage" screen shake (20% of max HP). */
const HEAVY_DMG_RATIO = 0.2;

const CHARGER_CONTACT_COOLDOWN = 4; // seconds before next charge after hitting player
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

  // --- Bomber fuse detonation check ---
  for (const enemy of enemies) {
    if (enemy.enemyType !== 'bomber') continue;
    if (enemy.bomberFuse === undefined || enemy.bomberFuse > 0) continue;
    // Fuse expired: explode!
    const explodeRadius = 60;
    const explodeDmg = enemy.damage ?? 25;

    // Damage player if in range
    if (players.entities.length > 0) {
      const pl = players.entities[0];
      const edx = pl.position.x - enemy.position.x;
      const edy = pl.position.y - enemy.position.y;
      if (edx * edx + edy * edy < explodeRadius * explodeRadius) {
        const reduced = reduceDamage(explodeDmg, enemy.level ?? 1);
        pl.health.current -= reduced;
        spawnDamageNumber(pl.position.x, pl.position.y - 10, reduced, 0xff6688);
        sfxPlayer.play('hit_magic');
        applyStatus(pl, StatusType.Knockback, enemy.position);
        if (pl.health.current <= 0) pl.health.current = 0;
      }
    }

    // Friendly fire: damage nearby enemies too
    for (const other of enemies) {
      if (other === enemy) continue;
      if (other.invulnerable) continue; // skip invulnerable enemies
      const odx = other.position.x - enemy.position.x;
      const ody = other.position.y - enemy.position.y;
      if (odx * odx + ody * ody < explodeRadius * explodeRadius) {
        const ffDmg = explodeDmg;
        other.health.current -= ffDmg;
        spawnDamageNumber(other.position.x, other.position.y - 10, ffDmg, 0xff6688);
        if (other.health.current <= 0 && !enemiesToRemove.includes(other)) {
          enemiesToRemove.push(other);
        }
      }
    }

    // Bomber dies on detonation
    if (!enemiesToRemove.includes(enemy)) {
      enemiesToRemove.push(enemy);
    }

    // Visual explosion
    spawnBomberExplosion(enemy.position.x, enemy.position.y, explodeRadius);
    shake(0.3, 5);
  }

  // --- Projectile vs Enemy ---
  /** Track per-frame hit count across all projectiles for multi-hit conditional */
  let frameHitCount = 0;

  for (const proj of projectiles) {
    let consumed = false;

    for (const enemy of enemies) {
      // Skip enemies already hit by this piercing projectile
      if (proj.piercing && proj.piercingHitIds?.has(enemy)) continue;

      const dx = proj.position.x - enemy.position.x;
      const dy = proj.position.y - enemy.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < HIT_RADIUS * HIT_RADIUS) {
        // Invulnerable enemies (phaser phased, burrower underground): skip damage
        if (enemy.invulnerable) {
          continue;
        }

        // Mirror: reflect projectile back toward player
        if (enemy.enemyType === 'mirror' && enemy.aiState === 'reflecting' && enemy.mirrorReflectCooldown !== undefined && enemy.mirrorReflectCooldown <= 0) {
          // Reverse projectile direction at 1.5x speed
          if (proj.velocity) {
            const speed = Math.sqrt(proj.velocity.x * proj.velocity.x + proj.velocity.y * proj.velocity.y);
            const newSpeed = speed * 1.5;
            // Aim reflected projectile at player
            if (players.entities.length > 0) {
              const pl = players.entities[0];
              const rdx = pl.position.x - proj.position.x;
              const rdy = pl.position.y - proj.position.y;
              const rlen = Math.sqrt(rdx * rdx + rdy * rdy);
              if (rlen > 0) {
                proj.velocity.x = (rdx / rlen) * newSpeed;
                proj.velocity.y = (rdy / rlen) * newSpeed;
              }
            }
            // Convert to enemy projectile by removing player projectile tag and adding enemy tag
            world.removeComponent(proj, 'projectile');
            world.addComponent(proj, 'enemyProjectile', true as const);
            // Set level for damage reduction calculation
            if (!proj.level) {
              world.addComponent(proj, 'level', enemy.level ?? 1);
            }
          }

          // Mirror enters cracked state
          enemy.mirrorReflectCooldown = MIRROR_REFLECT_COOLDOWN;
          enemy.aiState = 'cracked';
          if (enemy.sprite) enemy.sprite.alpha = 0.5;

          // Visual flash on reflect
          spawnDamageNumber(enemy.position.x, enemy.position.y - 10, 0, 0xccccff);
          sfxPlayer.play('hit_magic');

          consumed = true;
          break; // projectile is now an enemy projectile, stop checking
        }

        // Mirror in cracked state: takes double damage (handled below via multiplier)

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

        // Allseeing Visor: +25% damage to enemies below 20% HP
        if (hasEffect('visor_execute') && enemy.health.current / enemy.health.max < 0.2) {
          dmg = Math.round(dmg * 1.25);
        }

        // Shatterglass Lens: damage scaling based on projectile travel distance
        if (hasEffect('shatterglass_range_scaling') && proj.spawnPosition) {
          const tdx = proj.position.x - proj.spawnPosition.x;
          const tdy = proj.position.y - proj.spawnPosition.y;
          const travelDist = Math.sqrt(tdx * tdx + tdy * tdy);
          if (travelDist > 300) {
            dmg = Math.round(dmg * 1.2);
          } else if (travelDist < 100) {
            dmg = Math.round(dmg * 0.85);
          }
        }

        // Mirror cracked: takes double damage
        if (enemy.enemyType === 'mirror' && enemy.aiState === 'cracked') {
          dmg = Math.round(dmg * 2);
        }

        // Conditional affix: status-on-target damage bonus (e.g., +damage vs burning)
        const statusDmgBonus = getStatusOnTargetDamageBonus(enemy);
        if (statusDmgBonus > 0) {
          dmg = Math.round(dmg * (1 + statusDmgBonus / 100));
        }

        // Conditional affix: chance to slow on hit
        const slowChance = getEquippedConditionalValue('condOnHitSlow');
        if (slowChance > 0 && Math.random() * 100 < slowChance) {
          applyStatus(enemy, StatusType.Slow);
        }

        // Deal damage
        enemy.health.current -= dmg;
        spawnDamageNumber(enemy.position.x, enemy.position.y - 10, dmg, 0xffffff);
        spawnHitSparks(enemy.position.x, enemy.position.y, 'physical');
        sfxPlayer.play('hit_physical');

        // Vampiric Loop: recover 2% of damage dealt as health
        if (hasEffect('vampiric_leech') && players.entities.length > 0) {
          const pl = players.entities[0];
          const heal = Math.max(1, Math.round(dmg * 0.02));
          pl.health.current = Math.min(pl.health.max, pl.health.current + heal);
        }

        // Track multi-hit for conditional affix system
        frameHitCount++;

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

  // Report multi-hit count for conditional affix system (e.g., hit 3+ enemies: +damage)
  if (frameHitCount > 0) {
    trackMultiHit(frameHitCount);
  }

  for (const enemy of enemiesToRemove) {
    // Bomber: if killed before fuse detonation, explode at half damage/radius
    // (skip if bomber already detonated via fuse -- bomberFuse would be <= 0)
    if (enemy.enemyType === 'bomber' && (enemy.bomberFuse === undefined || enemy.bomberFuse > 0)) {
      const halfRadius = 30;
      const halfDmg = Math.round((enemy.damage ?? 25) / 2);
      // Damage player if in range
      if (players.entities.length > 0) {
        const pl = players.entities[0];
        const bdx = pl.position.x - enemy.position.x;
        const bdy = pl.position.y - enemy.position.y;
        if (bdx * bdx + bdy * bdy < halfRadius * halfRadius) {
          const reduced = reduceDamage(halfDmg, enemy.level ?? 1);
          pl.health.current -= reduced;
          spawnDamageNumber(pl.position.x, pl.position.y - 10, reduced, 0xff6688);
          applyStatus(pl, StatusType.Knockback, enemy.position);
          if (pl.health.current <= 0) pl.health.current = 0;
        }
      }
      // Friendly fire on nearby enemies
      for (const other of enemies) {
        if (other === enemy) continue;
        const odx = other.position.x - enemy.position.x;
        const ody = other.position.y - enemy.position.y;
        if (odx * odx + ody * ody < halfRadius * halfRadius) {
          other.health.current -= halfDmg;
          spawnDamageNumber(other.position.x, other.position.y - 10, halfDmg, 0xff6688);
          if (other.health.current <= 0 && !enemiesToRemove.includes(other)) {
            enemiesToRemove.push(other);
          }
        }
      }
      spawnBomberExplosion(enemy.position.x, enemy.position.y, halfRadius);
    }

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

    // Record corpse position for Necromancer raise mechanic
    recordCorpse(enemy.position.x, enemy.position.y);

    // Linker: if one dies, mark the partner as enraged
    if (enemy.enemyType === 'linker' && enemy.linkedPartner) {
      const partner = enemy.linkedPartner as typeof enemy;
      if (partner && !partner.dead && partner.health && partner.health.current > 0) {
        partner.linkerEnraged = true;
        partner.speed = (partner.baseSpeed ?? 70) * 2;
      }
      // Clean up beam sprite
      if (enemy.linkerBeamSprite) {
        (enemy.linkerBeamSprite as Graphics).removeFromParent();
        (enemy.linkerBeamSprite as Graphics).destroy();
        enemy.linkerBeamSprite = undefined;
      }
    }

    // Overcharger: on death, buff all nearby enemies
    if (enemy.enemyType === 'overcharger') {
      for (const other of enemies) {
        if (other === enemy || other.dead) continue;
        // Don't stack the buff
        if (other.overchargerDeathBuff) continue;
        const odx = other.position.x - enemy.position.x;
        const ody = other.position.y - enemy.position.y;
        if (odx * odx + ody * ody < OVERCHARGER_BUFF_RADIUS * OVERCHARGER_BUFF_RADIUS) {
          other.overchargerDeathBuff = true;
          other.overchargerBuffTimer = OVERCHARGER_BUFF_DURATION;
          // Store originals before buffing
          other.overchargerOrigSpeed = other.speed;
          other.overchargerOrigDamage = other.damage;
          // Apply buff
          if (other.speed !== undefined) {
            other.speed = Math.round(other.speed * (1 + OVERCHARGER_BUFF_SPEED_MULT));
          }
          if (other.damage !== undefined) {
            other.damage = Math.round(other.damage * (1 + OVERCHARGER_BUFF_DAMAGE_MULT));
          }
          // Visual: electric blue aura
          if (other.sprite) {
            other.sprite.tint = 0x44ccff;
          }
        }
      }
      // Visual: electric pulse explosion
      spawnOverchargerDeathPulse(enemy.position.x, enemy.position.y);
    }

    // Spawn death particles before removing
    spawnDeathParticles(enemy.position.x, enemy.position.y);
    sfxPlayer.play('enemy_death');

    // Grant XP to player based on enemy type and level
    grantXP(getEnemyXP(enemy.enemyType ?? 'rusher', enemy.level ?? 1));

    // Track kill for conditional affix system
    trackKill();

    // Conditional affix: on-kill heal (% of max HP)
    const onKillHealPct = getEquippedConditionalValue('condOnKillHeal');
    if (onKillHealPct > 0 && players.entities.length > 0) {
      const pl = players.entities[0];
      const heal = Math.max(1, Math.round(pl.health.max * onKillHealPct / 100));
      pl.health.current = Math.min(pl.health.max, pl.health.current + heal);
    }

    // Conditional affix: on-kill CDR (refund % of remaining cooldown on all skills)
    const onKillCDRPct = getEquippedConditionalValue('condOnKillCDR');
    if (onKillCDRPct > 0) {
      const skills = skillSystem.getSkills();
      for (const skill of skills) {
        if (skill && skill.cooldownRemaining > 0) {
          skill.cooldownRemaining *= (1 - onKillCDRPct / 100);
        }
      }
    }

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

    // Deathweaver Vest: enemies explode for 10% of their max HP on death
    if (hasEffect('deathweaver_explode')) {
      const deathRadius = 64;
      const deathDmg = Math.round(enemy.health.max * 0.1);
      spawnExplosionParticles(enemy.position.x, enemy.position.y);
      // Damage nearby enemies (not player)
      for (const other of enemies) {
        if (other === enemy) continue;
        const odx = other.position.x - enemy.position.x;
        const ody = other.position.y - enemy.position.y;
        if (odx * odx + ody * ody < deathRadius * deathRadius) {
          other.health.current -= deathDmg;
          spawnDamageNumber(other.position.x, other.position.y - 10, deathDmg, 0xff4400);
          if (other.health.current <= 0 && !enemiesToRemove.includes(other)) {
            enemiesToRemove.push(other);
          }
        }
      }
    }

    // Essence Conduit: kills grant 3s of +20% move/attack speed frenzy
    if (hasEffect('essence_kill_frenzy')) {
      activateFrenzy();
    }

    // Ricochet Longbow: on kill, bounce a projectile to nearest enemy within 128px
    if (hasEffect('ricochet_on_kill')) {
      let nearestBounce: (typeof enemies.entities)[number] | null = null;
      let nearestBounceDist = 128 * 128;
      for (const other of enemies) {
        if (other === enemy || enemiesToRemove.includes(other)) continue;
        const bdx = other.position.x - enemy.position.x;
        const bdy = other.position.y - enemy.position.y;
        const bDistSq = bdx * bdx + bdy * bdy;
        if (bDistSq < nearestBounceDist) {
          nearestBounceDist = bDistSq;
          nearestBounce = other;
        }
      }
      if (nearestBounce) {
        fireProjectile(
          enemy.position.x,
          enemy.position.y,
          nearestBounce.position.x,
          nearestBounce.position.y,
          { speed: 600, damage: 24, radius: 6, color: 0xccff00, lifetime: 1 },
        );
      }
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
    // Skip invulnerable enemies (phaser phased, burrower underground)
    if (enemy.invulnerable) continue;
    // Skip phaser in phased state (cannot deal contact damage)
    if (enemy.enemyType === 'phaser' && !enemy.phaserSolid) continue;

    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < CONTACT_RADIUS * CONTACT_RADIUS) {
      const reducedContactDmg = reduceDamage(enemy.damage, enemy.level ?? 1);
      player.health.current -= reducedContactDmg;
      trackDamageTaken();
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

      // Charger: apply stun on contact during charge
      if (enemy.enemyType === 'charger' && enemy.aiState === 'charging') {
        applyStatus(player, StatusType.Stun, enemy.position);
        // Stop the charge after hitting
        enemy.aiState = 'walking';
        enemy.aiTimer = CHARGER_CONTACT_COOLDOWN;
        enemy.chargerDir = undefined;
      }

      // Warper, Overcharger, Linker (enraged): apply Shock on contact
      if (enemy.enemyType === 'warper' || enemy.enemyType === 'overcharger' || (enemy.enemyType === 'linker' && enemy.linkerEnraged)) {
        applyStatus(player, StatusType.Shock, enemy.position);
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
      trackDamageTaken();
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

// ── Bomber explosion visual ───────────────────────────────────────────
function spawnBomberExplosion(x: number, y: number, radius: number): void {
  // Pink expanding ring + particles
  const ring = new Graphics();
  ring.circle(0, 0, 10).fill({ color: 0xff6688, alpha: 0.4 });
  ring.position.set(x, y);
  game.effectLayer.addChild(ring);

  const start = performance.now();
  const expand = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / 300, 1);
    const r = 10 + t * (radius - 10);
    ring.clear();
    ring.circle(0, 0, r).fill({ color: 0xff6688, alpha: 0.4 * (1 - t) });
    if (t >= 1) {
      ring.removeFromParent();
      ring.destroy();
    } else {
      requestAnimationFrame(expand);
    }
  };
  requestAnimationFrame(expand);

  // Particles
  for (let i = 0; i < 12; i++) {
    const g = new Graphics();
    g.circle(0, 0, 3).fill({ color: 0xff6688 });
    g.position.set(x, y);
    game.effectLayer.addChild(g);

    const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
    const speed = 100 * (0.6 + Math.random() * 0.4);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const pStart = performance.now();
    const tick = () => {
      const elapsed = performance.now() - pStart;
      const pt = Math.min(elapsed / 400, 1);
      g.position.x += vx * (1 / 60);
      g.position.y += vy * (1 / 60);
      g.alpha = 1 - pt;
      if (pt >= 1) {
        g.removeFromParent();
        g.destroy();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  sfxPlayer.play('enemy_death');
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

// ── Overcharger death pulse visual ─────────────────────────────────────
function spawnOverchargerDeathPulse(x: number, y: number): void {
  // Electric blue expanding ring
  const ring = new Graphics();
  ring.circle(0, 0, 10).stroke({ color: 0x44ccff, width: 3, alpha: 0.8 });
  ring.position.set(x, y);
  game.effectLayer.addChild(ring);

  const start = performance.now();
  const expand = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / 500, 1);
    const r = 10 + t * (OVERCHARGER_BUFF_RADIUS - 10);
    ring.clear();
    ring.circle(0, 0, r).stroke({ color: 0x44ccff, width: 3, alpha: 0.8 * (1 - t) });
    if (t >= 1) {
      ring.removeFromParent();
      ring.destroy();
    } else {
      requestAnimationFrame(expand);
    }
  };
  requestAnimationFrame(expand);

  // Electric particles
  for (let i = 0; i < 10; i++) {
    const g = new Graphics();
    g.circle(0, 0, 3).fill({ color: 0x88eeff });
    g.position.set(x, y);
    game.effectLayer.addChild(g);

    const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.5;
    const speed = 120 * (0.5 + Math.random() * 0.5);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const pStart = performance.now();
    const tick = () => {
      const elapsed = performance.now() - pStart;
      const pt = Math.min(elapsed / 400, 1);
      g.position.x += vx * (1 / 60);
      g.position.y += vy * (1 / 60);
      g.alpha = 1 - pt;
      if (pt >= 1) {
        g.removeFromParent();
        g.destroy();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }
}
