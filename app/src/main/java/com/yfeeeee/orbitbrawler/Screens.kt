// Orbit Brawler - Developer: @yfeeeee
package com.yfeeeee.orbitbrawler

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

private val GOLD = Color(0xFFFFD54F)
private val CYAN = Color(0xFF4FC3F7)
private val PANEL = Color(0xFF16324A)

@Composable
fun BrawlerApp(save: Save) {
    var world by remember { mutableStateOf<World?>(null) }
    val w = world
    MaterialTheme(colorScheme = darkColorScheme()) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color(0xFF0B1B2B))
                .systemBarsPadding()
        ) {
            if (w == null) {
                MenuScreen(save) { world = World(save) }
            } else {
                GameScreen(
                    w,
                    onRestart = { world = World(save) },
                    onExit = { world = null }
                )
            }
        }
    }
}

// ======================================================================= игра

@Composable
fun GameScreen(w: World, onRestart: () -> Unit, onExit: () -> Unit) {
    var tick by remember(w) { mutableIntStateOf(0) }
    val paint = remember {
        Paint().apply {
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
    }

    LaunchedEffect(w) {
        var last = withFrameNanos { it }
        while (true) {
            val now = withFrameNanos { it }
            val dt = ((now - last) / 1_000_000_000f).coerceAtMost(0.05f)
            last = now
            w.update(dt)
            tick += 1
        }
    }

    Box(Modifier.fillMaxSize()) {
        Canvas(
            Modifier
                .fillMaxSize()
                .pointerInput(w) {
                    detectDragGestures(
                        onDragStart = { o ->
                            w.joyActive = true
                            w.joyOx = o.x
                            w.joyOy = o.y
                            w.joyCx = o.x
                            w.joyCy = o.y
                            w.inX = 0f
                            w.inY = 0f
                        },
                        onDragEnd = { w.resetJoystick() },
                        onDragCancel = { w.resetJoystick() },
                        onDrag = { _, amount ->
                            w.joyCx += amount.x
                            w.joyCy += amount.y
                            val dx = w.joyCx - w.joyOx
                            val dy = w.joyCy - w.joyOy
                            val len = sqrt(dx * dx + dy * dy)
                            val maxR = 90f
                            if (len > maxR) {
                                w.joyCx = w.joyOx + dx / len * maxR
                                w.joyCy = w.joyOy + dy / len * maxR
                            }
                            val k = if (len > maxR) maxR else len
                            if (len > 0.001f) {
                                w.inX = dx / len * (k / maxR)
                                w.inY = dy / len * (k / maxR)
                            }
                        }
                    )
                }
        ) {
            val t = tick
            if (t >= 0) {
                renderWorld(w, paint)
            }
        }

        if (w.state == St.PLAY) {
            Text(
                "II",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp)
                    .background(Color(0x66000000), CircleShape)
                    .clickable {
                        w.resetJoystick()
                        w.state = St.PAUSED
                    }
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            )
        }

        if (w.state == St.LEVELUP) {
            LevelUpOverlay(w)
        }
        if (w.state == St.PAUSED) {
            PauseOverlay(w, onExit)
        }
        if (w.state == St.DEAD) {
            DeadOverlay(w, onRestart, onExit)
        }
    }
}

@Composable
fun LevelUpOverlay(w: World) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0xCC000000)),
        contentAlignment = Alignment.Center
    ) {
        Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("НОВЫЙ УРОВЕНЬ " + w.level + "!", color = GOLD, fontWeight = FontWeight.Bold, fontSize = 28.sp)
            Text("Выбери усиление", color = Color.White, fontSize = 15.sp, modifier = Modifier.padding(top = 4.dp))
            for (i in w.choices.indices) {
                val u = w.choices[i]
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .background(PANEL, RoundedCornerShape(14.dp))
                        .border(2.dp, CYAN, RoundedCornerShape(14.dp))
                        .clickable { w.choose(i) }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(u.icon, fontSize = 36.sp, modifier = Modifier.padding(end = 14.dp))
                    Column {
                        Text(u.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(u.desc, color = Color(0xFFB3E5FC), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun PauseOverlay(w: World, onExit: () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0xCC000000)),
        contentAlignment = Alignment.Center
    ) {
        Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("ПАУЗА", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 30.sp)
            Button(
                onClick = {
                    w.resetJoystick()
                    w.state = St.PLAY
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp)
                    .height(56.dp)
            ) {
                Text("ПРОДОЛЖИТЬ", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = { onExit() },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp)
            ) {
                Text("В МЕНЮ")
            }
        }
    }
}

@Composable
fun DeadOverlay(w: World, onRestart: () -> Unit, onExit: () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0xDD000000)),
        contentAlignment = Alignment.Center
    ) {
        Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("ТЫ ПАЛ", color = Color(0xFFFF5252), fontWeight = FontWeight.Bold, fontSize = 34.sp)
            Text(
                "Время: " + fmtTime(w.time.toInt()) + "   Убито: " + w.kills,
                color = Color.White,
                fontSize = 18.sp,
                modifier = Modifier.padding(top = 10.dp)
            )
            Text("Уровень героя: " + w.level, color = Color(0xFFB3E5FC), fontSize = 16.sp)
            Text(
                "+" + w.goldEarned + " золота",
                color = GOLD,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
            Button(
                onClick = { onRestart() },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp)
                    .height(56.dp)
            ) {
                Text("ЗАНОВО", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = { onExit() },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp)
            ) {
                Text("В МЕНЮ (улучшения)")
            }
        }
    }
}

// ======================================================================= меню

@Composable
fun MenuScreen(save: Save, onPlay: () -> Unit) {
    var ang by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        var last = withFrameNanos { it }
        while (true) {
            val now = withFrameNanos { it }
            ang += (now - last) / 1_000_000_000f * 2.2f
            last = now
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("ORBIT BRAWLER", color = CYAN, fontWeight = FontWeight.Bold, fontSize = 32.sp)
        Text("Developer: @yfeeeee", color = Color(0xFF90A4AE), fontSize = 13.sp)

        Canvas(
            Modifier
                .fillMaxWidth()
                .height(230.dp)
        ) {
            val c = Offset(size.width / 2f, size.height / 2f + 10f)
            val sc = 2.2f
            for (k in 0 until 3) {
                val a = ang + k * (TWO_PI / 3f)
                val wx = c.x + cos(a) * 95f * sc * 0.75f
                val wy = c.y + sin(a) * 95f * sc * 0.75f
                drawLine(Color(0xFF90A4AE), c, Offset(wx, wy), strokeWidth = 5f)
                drawAxe(wx, wy, a, sc * 0.75f)
            }
            drawHero(c.x, c.y, sc, 1f, false)
        }

        Text(
            "Золото: " + save.gold,
            color = GOLD,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp
        )
        Text(
            "Рекорд: " + fmtTime(save.bestTime) + "   Убито за забег: " + save.bestKills,
            color = Color(0xFFB3E5FC),
            fontSize = 14.sp,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        UpgradeRow("❤", "Здоровье", "+10 макс. HP за уровень", save.hpLvl, save) {
            save.hpLvl += 1
        }
        UpgradeRow("💪", "Сила", "+5% урона за уровень", save.dmgLvl, save) {
            save.dmgLvl += 1
        }
        UpgradeRow("👟", "Скорость", "+3% скорости за уровень", save.spdLvl, save) {
            save.spdLvl += 1
        }

        Button(
            onClick = { onPlay() },
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 18.dp)
                .height(64.dp)
        ) {
            Text("ИГРАТЬ", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
        Text(
            "Двигай пальцем по экрану - герой бежит, оружие крутится само.",
            color = Color(0xFF90A4AE),
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 10.dp)
        )
    }
}

@Composable
fun UpgradeRow(icon: String, title: String, desc: String, lvl: Int, save: Save, onBuy: () -> Unit) {
    val maxed = lvl >= 10
    val price = save.cost(lvl)
    val canBuy = !maxed && save.gold >= price
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .background(PANEL, RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFF2E5A7A), RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 28.sp, modifier = Modifier.padding(end = 10.dp))
        Column(Modifier.weight(1f)) {
            Text(title + "  ур. " + lvl + "/10", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(desc, color = Color(0xFFB3E5FC), fontSize = 12.sp)
        }
        Button(
            onClick = {
                save.gold -= price
                onBuy()
                save.store()
            },
            enabled = canBuy
        ) {
            Text(if (maxed) "MAX" else "" + price)
        }
    }
}
