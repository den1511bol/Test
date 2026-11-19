// Orbit Brawler - Developer: @yfeeeee
package com.yfeeeee.orbitbrawler

import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

const val TWO_PI = 6.2831855f

fun fmtTime(s: Int): String = "%d:%02d".format(s / 60, s % 60)

/** Постоянный прогресс между забегами. */
class Save(private val prefs: SharedPreferences) {
    var gold by mutableIntStateOf(prefs.getInt("gold", 0))
    var hpLvl by mutableIntStateOf(prefs.getInt("hpLvl", 0))
    var dmgLvl by mutableIntStateOf(prefs.getInt("dmgLvl", 0))
    var spdLvl by mutableIntStateOf(prefs.getInt("spdLvl", 0))
    var bestTime by mutableIntStateOf(prefs.getInt("bestTime", 0))
    var bestKills by mutableIntStateOf(prefs.getInt("bestKills", 0))

    fun cost(lvl: Int): Int = 40 + lvl * 35

    fun store() {
        prefs.edit()
            .putInt("gold", gold)
            .putInt("hpLvl", hpLvl)
            .putInt("dmgLvl", dmgLvl)
            .putInt("spdLvl", spdLvl)
            .putInt("bestTime", bestTime)
            .putInt("bestKills", bestKills)
            .apply()
    }
}

object St {
    const val PLAY = 0
    const val LEVELUP = 1
    const val DEAD = 2
    const val PAUSED = 3
}

class Enemy(
    var x: Float,
    var y: Float,
    val kind: Int,
    var hp: Float,
    val maxHp: Float,
    val speed: Float,
    val radius: Float,
    val dmg: Float,
    val xp: Int
) {
    var flash = 0f
    var axeCd = 0f
    var hammerCd = 0f
    var kx = 0f
    var ky = 0f
}

class Gem(var x: Float, var y: Float, val value: Int)

class Bolt(
    var x: Float,
    var y: Float,
    val vx: Float,
    val vy: Float,
    var life: Float,
    val dmg: Float,
    var pierce: Int
) {
    val hit = ArrayList<Enemy>()
}

class Crate(val x: Float, val y: Float)

class FloatText(var x: Float, var y: Float, val text: String, var life: Float, val color: Int)

class Particle(var x: Float, var y: Float, var vx: Float, var vy: Float, var life: Float, val color: Int)

class Upgrade(val id: Int, val title: String, val desc: String, val icon: String)

class World(private val save: Save) {
    var state by mutableIntStateOf(St.PLAY)

    // герой
    var hx = 0f
    var hy = 0f
    var maxHp = 100f + save.hpLvl * 10f
    var hp = maxHp
    var speed = 190f * (1f + save.spdLvl * 0.03f)
    var dmgMul = 1f + save.dmgLvl * 0.05f
    var magnet = 1f
    var regen = 0f
    var hurtCd = 0f
    var faceX = 1f
    var shake = 0f

    // прогресс забега
    var time = 0f
    var kills = 0
    var level = 1
    var xp = 0
    var xpNeed = 8
    var pendingLevels = 0
    var goldEarned = 0

    // оружие
    var axeLvl = 1
    var hammerLvl = 0
    var boltLvl = 0
    var orbitAngle = 0f
    var hammerAngle = 0f
    var boltCd = 0f

    // ввод (джойстик, экранные координаты)
    var inX = 0f
    var inY = 0f
    var joyActive = false
    var joyOx = 0f
    var joyOy = 0f
    var joyCx = 0f
    var joyCy = 0f

    // объекты мира
    val enemies = ArrayList<Enemy>()
    val gems = ArrayList<Gem>()
    val bolts = ArrayList<Bolt>()
    val crates = ArrayList<Crate>()
    val texts = ArrayList<FloatText>()
    val particles = ArrayList<Particle>()

    private var spawnAcc = 0f
    private var nextBossAt = 90f
    private var crateTimer = 10f

    var choices by mutableStateOf<List<Upgrade>>(emptyList())
    var bannerText = ""
    var bannerLife = 0f

    fun axeCount(): Int = min(5, (axeLvl + 2) / 2)

    fun hammerCount(): Int = if (hammerLvl <= 0) 0 else if (hammerLvl >= 8) 3 else if (hammerLvl >= 4) 2 else 1

    fun axeRadius(): Float = 95f + axeLvl * 7f

    fun hammerRadius(): Float = 175f + hammerLvl * 4f

    private fun showBanner(msg: String) {
        bannerText = msg
        bannerLife = 2.4f
    }

    fun resetJoystick() {
        joyActive = false
        inX = 0f
        inY = 0f
    }

    // ---------------------------------------------------------------- главный шаг

    fun update(dt: Float) {
        if (state != St.PLAY) return
        time += dt

        hx += inX * speed * dt
        hy += inY * speed * dt
        if (abs(inX) > 0.1f) faceX = if (inX > 0f) 1f else -1f
        if (regen > 0f) hp = min(maxHp, hp + regen * dt)
        hurtCd = max(0f, hurtCd - dt)
        shake = max(0f, shake - dt)
        bannerLife = max(0f, bannerLife - dt)

        crateTimer -= dt
        if (crateTimer <= 0f) {
            crateTimer = 28f
            val a = Random.nextFloat() * TWO_PI
            val d = 220f + Random.nextFloat() * 100f
            crates.add(Crate(hx + cos(a) * d, hy + sin(a) * d))
            showBanner("Ящик с оружием рядом!")
        }

        spawn(dt)
        moveEnemies(dt)
        weapons(dt)
        updateBolts(dt)
        cleanup()
        updateGems(dt)
        updateCrates()
        updateFx(dt)

        if (hp <= 0f) {
            die()
            return
        }
        if (pendingLevels > 0) {
            pendingLevels -= 1
            openLevelUp()
        }
    }

    // ---------------------------------------------------------------- враги

    private fun spawn(dt: Float) {
        val rate = 1.6f + time * 0.045f
        spawnAcc += rate * dt
        while (spawnAcc >= 1f) {
            spawnAcc -= 1f
            if (enemies.size < 160) spawnOne()
        }
        if (time >= nextBossAt) {
            nextBossAt += 90f
            spawnBoss()
        }
    }

    private fun spawnOne() {
        val a = Random.nextFloat() * TWO_PI
        val ex = hx + cos(a) * 470f
        val ey = hy + sin(a) * 820f
        val r = Random.nextFloat()
        val kind = if (time > 60f && r < 0.18f) 2 else if (time > 25f && r < 0.40f) 1 else 0
        val sc = 1f + time / 70f
        val e = when (kind) {
            1 -> Enemy(ex, ey, 1, 55f * sc, 55f * sc, 62f, 22f, 14f, 3)
            2 -> Enemy(ex, ey, 2, 10f * sc, 10f * sc, 150f, 12f, 6f, 1)
            else -> Enemy(ex, ey, 0, 18f * sc, 18f * sc, 85f, 16f, 8f, 1)
        }
        enemies.add(e)
    }

    private fun spawnBoss() {
        val a = Random.nextFloat() * TWO_PI
        val hpv = 700f * (1f + time / 120f)
        enemies.add(Enemy(hx + cos(a) * 470f, hy + sin(a) * 820f, 3, hpv, hpv, 55f, 54f, 30f, 40))
        showBanner("БОСС ПРИБЛИЖАЕТСЯ!")
    }

    private fun moveEnemies(dt: Float) {
        for (e in enemies) {
            val dx = hx - e.x
            val dy = hy - e.y
            val d = max(1f, sqrt(dx * dx + dy * dy))
            e.x += (dx / d * e.speed + e.kx) * dt
            e.y += (dy / d * e.speed + e.ky) * dt
            val decay = min(1f, 8f * dt)
            e.kx -= e.kx * decay
            e.ky -= e.ky * decay
            e.flash = max(0f, e.flash - dt)
            e.axeCd -= dt
            e.hammerCd -= dt
            if (d < e.radius + 24f && hurtCd <= 0f) {
                hurt(e.dmg)
            }
        }
        // мягкое расталкивание, чтобы толпа не слипалась в одну точку
        val n = enemies.size
        for (i in 0 until n) {
            val a = enemies[i]
            for (j in i + 1 until n) {
                val b = enemies[j]
                val dx = b.x - a.x
                val dy = b.y - a.y
                val minD = (a.radius + b.radius) * 0.8f
                if (abs(dx) < minD && abs(dy) < minD) {
                    val d2 = dx * dx + dy * dy
                    if (d2 < minD * minD && d2 > 0.01f) {
                        val d = sqrt(d2)
                        val push = (minD - d) * 0.5f
                        val ux = dx / d
                        val uy = dy / d
                        a.x -= ux * push
                        a.y -= uy * push
                        b.x += ux * push
                        b.y += uy * push
                    }
                }
            }
        }
    }

    private fun hurt(dmg: Float) {
        hp -= dmg
        hurtCd = 0.45f
        shake = 0.25f
        if (texts.size < 50) {
            texts.add(FloatText(hx, hy - 40f, "-" + dmg.toInt(), 0.7f, 0xFFFF5252.toInt()))
        }
    }

    private fun hit(e: Enemy, dmg: Float, knock: Float, fx: Float, fy: Float) {
        e.hp -= dmg
        e.flash = 0.12f
        var dx = e.x - fx
        var dy = e.y - fy
        val d = max(1f, sqrt(dx * dx + dy * dy))
        dx /= d
        dy /= d
        val kk = if (e.kind == 3) knock * 0.25f else knock
        e.kx += dx * kk
        e.ky += dy * kk
        if (texts.size < 50) {
            texts.add(FloatText(e.x, e.y - e.radius, dmg.toInt().toString(), 0.6f, 0xFFFFFFFF.toInt()))
        }
        if (particles.size < 200) {
            for (i in 0 until 3) {
                particles.add(
                    Particle(
                        e.x, e.y,
                        (Random.nextFloat() - 0.5f) * 260f,
                        (Random.nextFloat() - 0.5f) * 260f,
                        0.3f, 0xFFFFE082.toInt()
                    )
                )
            }
        }
    }

    private fun cleanup() {
        val iter = enemies.iterator()
        while (iter.hasNext()) {
            val e = iter.next()
            val dx = e.x - hx
            val dy = e.y - hy
            if (e.hp <= 0f) {
                onKill(e)
                iter.remove()
            } else if (dx * dx + dy * dy > 1600f * 1600f) {
                iter.remove()
            }
        }
    }

    private fun onKill(e: Enemy) {
        kills += 1
        if (gems.size < 300) {
            gems.add(Gem(e.x, e.y, e.xp))
        } else {
            addXp(e.xp)
        }
        if (particles.size < 200) {
            for (i in 0 until 6) {
                particles.add(
                    Particle(
                        e.x, e.y,
                        (Random.nextFloat() - 0.5f) * 340f,
                        (Random.nextFloat() - 0.5f) * 340f,
                        0.45f, 0xFFFF8A65.toInt()
                    )
                )
            }
        }
        if (e.kind == 3) {
            crates.add(Crate(e.x, e.y))
            showBanner("БОСС ПОВЕРЖЕН!")
        }
    }

    // ---------------------------------------------------------------- оружие

    private fun weapons(dt: Float) {
        orbitAngle += (2.4f + axeLvl * 0.12f) * dt
        hammerAngle -= 1.5f * dt

        // топоры
        val n = axeCount()
        val axeDmg = (14f + axeLvl * 5f) * dmgMul
        val axeR = axeRadius()
        for (k in 0 until n) {
            val a = orbitAngle + k * (TWO_PI / n)
            val wx = hx + cos(a) * axeR
            val wy = hy + sin(a) * axeR
            for (e in enemies) {
                if (e.axeCd > 0f) continue
                val dx = e.x - wx
                val dy = e.y - wy
                val rr = e.radius + 20f
                if (dx * dx + dy * dy < rr * rr) {
                    hit(e, axeDmg, 170f, wx, wy)
                    e.axeCd = 0.4f
                }
            }
        }

        // молоты
        val hn = hammerCount()
        if (hn > 0) {
            val hamDmg = (38f + hammerLvl * 9f) * dmgMul
            val hamR = hammerRadius()
            for (k in 0 until hn) {
                val a = hammerAngle + k * (TWO_PI / hn)
                val wx = hx + cos(a) * hamR
                val wy = hy + sin(a) * hamR
                for (e in enemies) {
                    if (e.hammerCd > 0f) continue
                    val dx = e.x - wx
                    val dy = e.y - wy
                    val rr = e.radius + 36f
                    if (dx * dx + dy * dy < rr * rr) {
                        hit(e, hamDmg, 420f, wx, wy)
                        e.hammerCd = 0.7f
                    }
                }
            }
        }

        // магические снаряды
        boltCd -= dt
        if (boltLvl > 0 && boltCd <= 0f) {
            boltCd = max(0.35f, 1.2f - boltLvl * 0.1f)
            var best: Enemy? = null
            var bd = 1e9f
            for (e in enemies) {
                val dx = e.x - hx
                val dy = e.y - hy
                val d2 = dx * dx + dy * dy
                if (d2 < bd) {
                    bd = d2
                    best = e
                }
            }
            if (best != null && bd < 700f * 700f) {
                val count = 1 + boltLvl / 3
                val base = atan2(best.y - hy, best.x - hx)
                for (i in 0 until count) {
                    val ang = base + (i - (count - 1) / 2f) * 0.22f
                    bolts.add(
                        Bolt(
                            hx, hy,
                            cos(ang) * 520f, sin(ang) * 520f,
                            1.4f,
                            (20f + boltLvl * 6f) * dmgMul,
                            1 + boltLvl / 2
                        )
                    )
                }
            }
        }
    }

    private fun updateBolts(dt: Float) {
        for (b in bolts) {
            b.x += b.vx * dt
            b.y += b.vy * dt
            b.life -= dt
            if (b.life <= 0f) continue
            for (e in enemies) {
                if (b.hit.contains(e)) continue
                val dx = e.x - b.x
                val dy = e.y - b.y
                val rr = e.radius + 10f
                if (dx * dx + dy * dy < rr * rr) {
                    hit(e, b.dmg, 120f, b.x - b.vx * 0.05f, b.y - b.vy * 0.05f)
                    b.hit.add(e)
                    b.pierce -= 1
                    if (b.pierce <= 0) {
                        b.life = 0f
                        break
                    }
                }
            }
        }
        bolts.removeAll { it.life <= 0f }
    }

    // ---------------------------------------------------------------- кристаллы, ящики

    private fun addXp(v: Int) {
        xp += v
        while (xp >= xpNeed) {
            xp -= xpNeed
            level += 1
            xpNeed = 8 + level * 5
            pendingLevels += 1
        }
    }

    private fun updateGems(dt: Float) {
        val mr = 110f * magnet
        val iter = gems.iterator()
        while (iter.hasNext()) {
            val g = iter.next()
            val dx = hx - g.x
            val dy = hy - g.y
            val d = max(1f, sqrt(dx * dx + dy * dy))
            if (d < mr) {
                g.x += dx / d * 440f * dt
                g.y += dy / d * 440f * dt
            }
            if (d < 30f) {
                addXp(g.value)
                iter.remove()
            }
        }
    }

    private fun updateCrates() {
        val iter = crates.iterator()
        while (iter.hasNext()) {
            val c = iter.next()
            val dx = hx - c.x
            val dy = hy - c.y
            if (dx * dx + dy * dy < 46f * 46f) {
                giveWeapon()
                iter.remove()
            }
        }
    }

    private fun giveWeapon() {
        val opts = ArrayList<Int>()
        if (axeLvl < 8) opts.add(0)
        if (hammerLvl < 8) opts.add(1)
        if (boltLvl < 8) opts.add(2)
        if (opts.isEmpty()) {
            hp = min(maxHp, hp + maxHp * 0.3f)
            showBanner("ЛЕЧЕНИЕ")
            return
        }
        when (opts[Random.nextInt(opts.size)]) {
            0 -> {
                axeLvl += 1
                showBanner("НОВОЕ ОРУЖИЕ: ТОПОР, УР. $axeLvl")
            }
            1 -> {
                hammerLvl += 1
                showBanner("НОВОЕ ОРУЖИЕ: МОЛОТ, УР. $hammerLvl")
            }
            else -> {
                boltLvl += 1
                showBanner("НОВОЕ ОРУЖИЕ: МАГИЯ, УР. $boltLvl")
            }
        }
    }

    private fun updateFx(dt: Float) {
        var i = texts.size - 1
        while (i >= 0) {
            val t = texts[i]
            t.y -= 46f * dt
            t.life -= dt
            if (t.life <= 0f) texts.removeAt(i)
            i -= 1
        }
        var j = particles.size - 1
        while (j >= 0) {
            val p = particles[j]
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.life -= dt
            if (p.life <= 0f) particles.removeAt(j)
            j -= 1
        }
    }

    // ---------------------------------------------------------------- уровни

    private fun openLevelUp() {
        val pool = ArrayList<Upgrade>()
        if (axeLvl < 8) {
            pool.add(Upgrade(0, "Топор", "Уровень ${axeLvl + 1}: больше топоров и урона", "🪓"))
        }
        if (hammerLvl < 8) {
            val title = if (hammerLvl == 0) "Новое: Молот" else "Молот"
            pool.add(Upgrade(1, title, "Уровень ${hammerLvl + 1}: тяжёлый удар и отбрасывание", "🔨"))
        }
        if (boltLvl < 8) {
            val title = if (boltLvl == 0) "Новое: Магия" else "Магия"
            pool.add(Upgrade(2, title, "Уровень ${boltLvl + 1}: больше магических снарядов", "🔮"))
        }
        pool.add(Upgrade(3, "Здоровье", "+25 макс. HP и лечение", "❤"))
        pool.add(Upgrade(4, "Скорость", "+8% к скорости бега", "👟"))
        pool.add(Upgrade(5, "Сила", "+12% урона всего оружия", "💪"))
        pool.add(Upgrade(6, "Магнит", "Кристаллы притягиваются издалека", "🧲"))
        pool.add(Upgrade(7, "Регенерация", "+0.8 HP в секунду", "✚"))
        pool.shuffle()
        choices = pool.take(3)
        resetJoystick()
        state = St.LEVELUP
    }

    fun choose(i: Int) {
        val u = choices.getOrNull(i) ?: return
        when (u.id) {
            0 -> axeLvl += 1
            1 -> hammerLvl += 1
            2 -> boltLvl += 1
            3 -> {
                maxHp += 25f
                hp = min(maxHp, hp + 40f)
            }
            4 -> speed *= 1.08f
            5 -> dmgMul += 0.12f
            6 -> magnet += 0.35f
            else -> regen += 0.8f
        }
        resetJoystick()
        state = St.PLAY
    }

    private fun die() {
        state = St.DEAD
        goldEarned = kills / 4 + (time / 12f).toInt()
        save.gold += goldEarned
        val secs = time.toInt()
        if (secs > save.bestTime) save.bestTime = secs
        if (kills > save.bestKills) save.bestKills = kills
        save.store()
    }
}
