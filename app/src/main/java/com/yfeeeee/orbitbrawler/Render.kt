// Orbit Brawler - Developer: @yfeeeee
package com.yfeeeee.orbitbrawler

import android.graphics.Paint
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.random.Random

private fun cellHash(ix: Int, iy: Int): Int {
    var h = ix * 374761393 + iy * 668265263
    h = (h xor (h ushr 13)) * 1274126177.toInt()
    return h xor (h ushr 16)
}

/** Текст с тёмной обводкой, рисуется напрямую в нативный canvas. */
fun DrawScope.drawLabel(p: Paint, s: String, x: Float, y: Float, sizePx: Float, color: Int) {
    p.textSize = sizePx
    p.color = 0xCC000000.toInt()
    drawContext.canvas.nativeCanvas.drawText(s, x + 2f, y + 2f, p)
    p.color = color
    drawContext.canvas.nativeCanvas.drawText(s, x, y, p)
}

// ------------------------------------------------------------------ герой

/** Оригинальный герой: зелёный здоровяк с рожками. Рисуется кругами, без картинок. */
fun DrawScope.drawHero(x: Float, y: Float, sc: Float, face: Float, hurt: Boolean) {
    // тень
    drawOval(Color(0x55000000), Offset(x - 28f * sc, y + 14f * sc), Size(56f * sc, 22f * sc))
    // тело
    drawCircle(Color(0xFF558B2F), 27f * sc, Offset(x, y))
    drawCircle(Color(0xFF7CB342), 24f * sc, Offset(x, y - 2f * sc))
    // пояс
    drawRect(Color(0xFF5D4037), Offset(x - 22f * sc, y + 6f * sc), Size(44f * sc, 7f * sc))
    drawRect(Color(0xFFFFCA28), Offset(x - 5f * sc, y + 5f * sc), Size(10f * sc, 9f * sc))
    // голова
    val hx = x + face * 3f * sc
    val hy = y - 21f * sc
    drawCircle(Color(0xFF9CCC65), 14f * sc, Offset(hx, hy))
    // рожки
    val horn = Path()
    horn.moveTo(hx - 12f * sc, hy - 6f * sc)
    horn.lineTo(hx - 17f * sc, hy - 22f * sc)
    horn.lineTo(hx - 5f * sc, hy - 11f * sc)
    horn.close()
    drawPath(horn, Color(0xFFFFF3E0))
    val horn2 = Path()
    horn2.moveTo(hx + 12f * sc, hy - 6f * sc)
    horn2.lineTo(hx + 17f * sc, hy - 22f * sc)
    horn2.lineTo(hx + 5f * sc, hy - 11f * sc)
    horn2.close()
    drawPath(horn2, Color(0xFFFFF3E0))
    // глаза
    drawCircle(Color.White, 4.5f * sc, Offset(hx - 5f * sc + face * 1.5f * sc, hy - 1f * sc))
    drawCircle(Color.White, 4.5f * sc, Offset(hx + 5f * sc + face * 1.5f * sc, hy - 1f * sc))
    drawCircle(Color(0xFF1B1B1B), 2.2f * sc, Offset(hx - 5f * sc + face * 3f * sc, hy - 1f * sc))
    drawCircle(Color(0xFF1B1B1B), 2.2f * sc, Offset(hx + 5f * sc + face * 3f * sc, hy - 1f * sc))
    // клыки
    drawRect(Color.White, Offset(hx - 6f * sc, hy + 6f * sc), Size(3f * sc, 4f * sc))
    drawRect(Color.White, Offset(hx + 3f * sc, hy + 6f * sc), Size(3f * sc, 4f * sc))
    if (hurt) {
        drawCircle(Color(0x66FF1744), 28f * sc, Offset(x, y))
    }
}

fun DrawScope.drawAxe(wx: Float, wy: Float, ang: Float, sc: Float) {
    val deg = ang * 57.29578f + 90f
    rotate(deg, Offset(wx, wy)) {
        drawRect(Color(0xFF6D4C41), Offset(wx - 3f * sc, wy - 20f * sc), Size(6f * sc, 40f * sc))
        drawRect(Color(0xFFB0BEC5), Offset(wx - 17f * sc, wy - 24f * sc), Size(34f * sc, 13f * sc))
        drawRect(Color(0xFFECEFF1), Offset(wx - 17f * sc, wy - 24f * sc), Size(34f * sc, 4f * sc))
    }
}

fun DrawScope.drawHammer(wx: Float, wy: Float, ang: Float, sc: Float) {
    val deg = ang * 57.29578f + 90f
    rotate(deg, Offset(wx, wy)) {
        drawRect(Color(0xFF5D4037), Offset(wx - 4f * sc, wy - 22f * sc), Size(8f * sc, 46f * sc))
        drawRect(Color(0xFF546E7A), Offset(wx - 24f * sc, wy - 34f * sc), Size(48f * sc, 24f * sc))
        drawRect(Color(0xFF90A4AE), Offset(wx - 24f * sc, wy - 34f * sc), Size(48f * sc, 6f * sc))
    }
}

// ------------------------------------------------------------------ враги

private fun DrawScope.drawEnemy(e: Enemy, x: Float, y: Float, sc: Float, time: Float) {
    val r = e.radius * sc
    drawOval(Color(0x44000000), Offset(x - r, y + r * 0.5f), Size(r * 2f, r * 0.8f))
    when (e.kind) {
        0 -> {
            drawCircle(Color(0xFFE53935), r, Offset(x, y))
            drawCircle(Color(0xFFFFCCBC), r * 0.62f, Offset(x, y + r * 0.15f))
            drawCircle(Color(0xFF212121), r * 0.14f, Offset(x - r * 0.25f, y + r * 0.1f))
            drawCircle(Color(0xFF212121), r * 0.14f, Offset(x + r * 0.25f, y + r * 0.1f))
        }
        1 -> {
            drawCircle(Color(0xFF3949AB), r, Offset(x, y))
            drawRect(Color(0xFFFFD54F), Offset(x - r * 0.6f, y - r * 0.2f), Size(r * 1.2f, r * 0.35f))
            drawCircle(Color(0xFFD32F2F), r * 0.35f, Offset(x, y - r * 1.0f))
        }
        2 -> {
            val flap = sin(time * 18f + e.x) * r * 0.25f
            drawCircle(Color(0xCC6A1B9A), r * 0.8f, Offset(x - r * 1.1f, y - flap))
            drawCircle(Color(0xCC6A1B9A), r * 0.8f, Offset(x + r * 1.1f, y - flap))
            drawCircle(Color(0xFF8E24AA), r, Offset(x, y))
            drawCircle(Color(0xFFFFEB3B), r * 0.2f, Offset(x - r * 0.35f, y - r * 0.1f))
            drawCircle(Color(0xFFFFEB3B), r * 0.2f, Offset(x + r * 0.35f, y - r * 0.1f))
        }
        else -> {
            drawCircle(Color(0xFF7F0000), r, Offset(x, y))
            drawCircle(Color(0xFFB71C1C), r * 0.88f, Offset(x, y - r * 0.05f))
            val hl = Path()
            hl.moveTo(x - r * 0.8f, y - r * 0.5f)
            hl.lineTo(x - r * 0.95f, y - r * 1.3f)
            hl.lineTo(x - r * 0.3f, y - r * 0.8f)
            hl.close()
            drawPath(hl, Color(0xFFFFF3E0))
            val hr = Path()
            hr.moveTo(x + r * 0.8f, y - r * 0.5f)
            hr.lineTo(x + r * 0.95f, y - r * 1.3f)
            hr.lineTo(x + r * 0.3f, y - r * 0.8f)
            hr.close()
            drawPath(hr, Color(0xFFFFF3E0))
            drawCircle(Color(0xFFFFEB3B), r * 0.16f, Offset(x - r * 0.35f, y - r * 0.1f))
            drawCircle(Color(0xFFFFEB3B), r * 0.16f, Offset(x + r * 0.35f, y - r * 0.1f))
        }
    }
    if (e.flash > 0f) {
        drawCircle(Color(0xAAFFFFFF), r, Offset(x, y))
    }
    if (e.hp < e.maxHp) {
        val bw = r * 2f
        drawRect(Color(0xFF3E0000), Offset(x - r, y - r - 12f * sc), Size(bw, 5f * sc))
        drawRect(Color(0xFFFF1744), Offset(x - r, y - r - 12f * sc), Size(bw * (e.hp / e.maxHp).coerceIn(0f, 1f), 5f * sc))
    }
}

// ------------------------------------------------------------------ мир

fun DrawScope.renderWorld(w: World, p: Paint) {
    val sc = size.width / 700f
    val cx = size.width / 2f
    val cy = size.height / 2f
    val camX = w.hx + (Random.nextFloat() - 0.5f) * 40f * w.shake
    val camY = w.hy + (Random.nextFloat() - 0.5f) * 40f * w.shake

    fun sx(x: Float): Float = cx + (x - camX) * sc
    fun sy(y: Float): Float = cy + (y - camY) * sc

    // фон: ночной лес
    drawRect(Color(0xFF0D2538))

    val cell = 150f
    val halfW = size.width / 2f / sc + 100f
    val halfH = size.height / 2f / sc + 100f
    val ix0 = floor((camX - halfW) / cell).toInt()
    val ix1 = floor((camX + halfW) / cell).toInt()
    val iy0 = floor((camY - halfH) / cell).toInt()
    val iy1 = floor((camY + halfH) / cell).toInt()
    for (iy in iy0..iy1) {
        for (ix in ix0..ix1) {
            val h = cellHash(ix, iy)
            if ((h and 0xFF) < 72) {
                val px = sx(ix * cell + ((h ushr 10) and 127))
                val py = sy(iy * cell + ((h ushr 17) and 127))
                when ((h ushr 8) and 3) {
                    0 -> {
                        drawOval(Color(0x44000000), Offset(px - 30f * sc, py - 6f * sc), Size(60f * sc, 18f * sc))
                        drawRect(Color(0xFF3E2723), Offset(px - 4f * sc, py - 20f * sc), Size(8f * sc, 22f * sc))
                        val t1 = Path()
                        t1.moveTo(px, py - 55f * sc)
                        t1.lineTo(px - 34f * sc, py - 14f * sc)
                        t1.lineTo(px + 34f * sc, py - 14f * sc)
                        t1.close()
                        drawPath(t1, Color(0xFF0F3B57))
                        val t2 = Path()
                        t2.moveTo(px, py - 86f * sc)
                        t2.lineTo(px - 26f * sc, py - 42f * sc)
                        t2.lineTo(px + 26f * sc, py - 42f * sc)
                        t2.close()
                        drawPath(t2, Color(0xFF14506F))
                    }
                    1 -> {
                        drawCircle(Color(0xFF1B4F72), 30f * sc, Offset(px, py))
                        drawCircle(Color(0xFF2471A3), 16f * sc, Offset(px - 6f * sc, py - 8f * sc))
                    }
                    2 -> {
                        drawCircle(Color(0xFF4A3F7A), 20f * sc, Offset(px, py))
                        drawCircle(Color(0xFF65589A), 10f * sc, Offset(px - 5f * sc, py - 6f * sc))
                    }
                    else -> {
                        drawCircle(Color(0x334FC3F7), 24f * sc, Offset(px, py))
                        drawCircle(Color(0xFF4FC3F7), 6f * sc, Offset(px, py - 6f * sc))
                        drawRect(Color(0xFFB3E5FC), Offset(px - 2f * sc, py - 6f * sc), Size(4f * sc, 12f * sc))
                    }
                }
            }
        }
    }

    // кристаллы опыта
    for (g in w.gems) {
        val gx = sx(g.x)
        val gy = sy(g.y)
        drawCircle(Color(0x554FC3F7), 11f * sc, Offset(gx, gy))
        drawCircle(Color(0xFF4FC3F7), 6f * sc, Offset(gx, gy))
        drawCircle(Color(0xFFE1F5FE), 2.5f * sc, Offset(gx - 1.5f * sc, gy - 1.5f * sc))
    }

    // ящики с оружием
    for (c in w.crates) {
        val pulse = 1f + 0.12f * sin(w.time * 5f)
        val gx = sx(c.x)
        val gy = sy(c.y)
        drawCircle(Color(0x44FFC107), 34f * sc * pulse, Offset(gx, gy))
        drawRect(Color(0xFFFFC107), Offset(gx - 16f * sc, gy - 16f * sc), Size(32f * sc, 32f * sc))
        drawRect(Color(0xFF8D6E00), Offset(gx - 16f * sc, gy - 16f * sc), Size(32f * sc, 32f * sc), style = Stroke(3f * sc))
        drawLabel(p, "?", gx, gy + 9f * sc, 26f * sc, 0xFF5D4037.toInt())
        drawLabel(p, "ОРУЖИЕ", gx, gy - 24f * sc, 13f * sc, 0xFFFFF59D.toInt())
    }

    // враги
    for (e in w.enemies) {
        val ex = sx(e.x)
        val ey = sy(e.y)
        if (ex < -120f || ex > size.width + 120f || ey < -120f || ey > size.height + 120f) continue
        drawEnemy(e, ex, ey, sc, w.time)
    }

    // оружие героя
    val hxs = sx(w.hx)
    val hys = sy(w.hy)
    val an = w.axeCount()
    val axeR = w.axeRadius()
    for (k in 0 until an) {
        val a = w.orbitAngle + k * (TWO_PI / an)
        val wx = sx(w.hx + cos(a) * axeR)
        val wy = sy(w.hy + sin(a) * axeR)
        drawLine(Color(0xFF90A4AE), Offset(hxs, hys), Offset(wx, wy), strokeWidth = 3f * sc)
        drawAxe(wx, wy, a, sc)
    }
    val hn = w.hammerCount()
    val hamR = w.hammerRadius()
    for (k in 0 until hn) {
        val a = w.hammerAngle + k * (TWO_PI / hn)
        val wx = sx(w.hx + cos(a) * hamR)
        val wy = sy(w.hy + sin(a) * hamR)
        drawLine(Color(0xFF78909C), Offset(hxs, hys), Offset(wx, wy), strokeWidth = 4f * sc)
        drawHammer(wx, wy, a, sc)
    }

    // герой
    drawHero(hxs, hys, sc, w.faceX, w.hurtCd > 0.25f)

    // магические снаряды
    for (b in w.bolts) {
        val bx = sx(b.x)
        val by = sy(b.y)
        drawCircle(Color(0x66E040FB), 18f * sc, Offset(bx, by))
        drawCircle(Color(0xFFE040FB), 9f * sc, Offset(bx, by))
        drawCircle(Color(0xFFF3E5F5), 4f * sc, Offset(bx, by))
    }

    // частицы
    for (pt in w.particles) {
        val a = (pt.life * 3f).coerceIn(0f, 1f)
        drawCircle(Color(pt.color).copy(alpha = a), 3.5f * sc, Offset(sx(pt.x), sy(pt.y)))
    }

    // всплывающие числа
    for (t in w.texts) {
        val a = ((t.life / 0.6f).coerceIn(0f, 1f) * 255f).toInt()
        val col = (a shl 24) or (t.color and 0x00FFFFFF)
        drawLabel(p, t.text, sx(t.x), sy(t.y), 22f * sc, col)
    }

    drawHud(w, p)
    drawJoystick(w)
}

private fun DrawScope.drawHud(w: World, p: Paint) {
    val pad = 14f
    val barW = size.width * 0.46f
    // HP
    drawRect(Color(0xAA000000), Offset(pad, pad), Size(barW, 28f))
    drawRect(Color(0xFFE53935), Offset(pad, pad), Size(barW * (w.hp / w.maxHp).coerceIn(0f, 1f), 28f))
    drawLabel(p, "HP " + w.hp.toInt() + "/" + w.maxHp.toInt(), pad + barW / 2f, pad + 22f, 20f, 0xFFFFFFFF.toInt())
    // XP
    drawRect(Color(0xAA000000), Offset(pad, pad + 34f), Size(barW, 18f))
    drawRect(Color(0xFF29B6F6), Offset(pad, pad + 34f), Size(barW * (w.xp.toFloat() / w.xpNeed).coerceIn(0f, 1f), 18f))
    drawLabel(p, "УР. " + w.level, pad + barW / 2f, pad + 49f, 16f, 0xFFFFFFFF.toInt())
    // время и убийства
    drawLabel(p, fmtTime(w.time.toInt()), size.width * 0.70f, pad + 26f, 30f, 0xFFFFFFFF.toInt())
    drawLabel(p, "Убито: " + w.kills, size.width * 0.70f, pad + 56f, 20f, 0xFFFFE082.toInt())
    // баннер
    if (w.bannerLife > 0f) {
        val a = (w.bannerLife.coerceIn(0f, 1f) * 255f).toInt()
        drawLabel(p, w.bannerText, size.width / 2f, size.height * 0.30f, 32f, (a shl 24) or 0x00FFEB3B)
    }
}

private fun DrawScope.drawJoystick(w: World) {
    if (w.joyActive) {
        drawCircle(Color(0x33FFFFFF), 90f, Offset(w.joyOx, w.joyOy))
        drawCircle(Color(0x88FFFFFF), 90f, Offset(w.joyOx, w.joyOy), style = Stroke(4f))
        drawCircle(Color(0x88FFFFFF), 36f, Offset(w.joyCx, w.joyCy))
    } else {
        val c = Offset(size.width / 2f, size.height - 150f)
        drawCircle(Color(0x22FFFFFF), 80f, c)
        drawCircle(Color(0x44FFFFFF), 80f, c, style = Stroke(4f))
        drawCircle(Color(0x44FFFFFF), 32f, c)
    }
}
