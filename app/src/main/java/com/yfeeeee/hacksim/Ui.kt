// HackSim - Developer: @yfeeeee
package com.yfeeeee.hacksim

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.random.Random
import kotlinx.coroutines.delay

val BG = Color(0xFF050B07)
val PANEL = Color(0xFF0A140D)
val GREEN = Color(0xFF00FF66)
val GREEN_DIM = Color(0xFF1F7A45)
val AMBER = Color(0xFFFFB300)
val RED = Color(0xFFFF5252)
val BLUE = Color(0xFF4FC3F7)
val GOLD = Color(0xFFFFD54F)

fun toneColor(t: Tone): Color = when (t) {
    Tone.NORMAL -> Color(0xFFC8E6C9)
    Tone.OK -> GREEN
    Tone.WARN -> AMBER
    Tone.ERR -> RED
    Tone.INFO -> BLUE
    Tone.CMD -> Color.White
}

@Composable
fun HackApp(game: Game) {
    MaterialTheme(colorScheme = darkColorScheme()) {
        Column(
            Modifier
                .fillMaxSize()
                .background(BG)
                .systemBarsPadding()
                .imePadding()
        ) {
            StatusBar(game)
            Box(Modifier.weight(1f).fillMaxWidth()) {
                val m = game.mini
                when (m) {
                    is Mini.Code -> CodeGame(m, game)
                    is Mini.Firewall -> FirewallGame(m, game)
                    is Mini.Sequence -> SequenceGame(m, game)
                    null -> TerminalView(game)
                }
            }
            if (game.mini == null) {
                InputBar(game)
            }
        }
    }
}

@Composable
fun StatusBar(game: Game) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(PANEL)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(cash(game.money), color = GOLD, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text("REP ${game.rep}", color = BLUE, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
            Text("LVL ${game.level}", color = GREEN, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
            Text("PWN ${game.hackedCount}", color = AMBER, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
        }
        val d = game.conn
        if (d != null) {
            Text(
                "CONN ${d.ip}  ${d.hostname}",
                color = GREEN_DIM,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
            Box(
                Modifier
                    .padding(top = 3.dp)
                    .fillMaxWidth()
                    .height(5.dp)
                    .background(Color(0xFF1A2A1F))
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(game.trace / 100f)
                        .fillMaxHeight()
                        .background(if (game.trace > 70) RED else AMBER)
                )
            }
            Text(
                "TRACE ${game.trace}%",
                color = if (game.trace > 70) RED else AMBER,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
fun TerminalView(game: Game) {
    val listState = rememberLazyListState()
    LaunchedEffect(game.lines.size) {
        if (game.lines.isNotEmpty()) {
            listState.scrollToItem(game.lines.size - 1)
        }
    }
    LazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        items(game.lines) { l ->
            Text(
                l.text,
                color = toneColor(l.tone),
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp
            )
        }
    }
}

@Composable
fun InputBar(game: Game) {
    var text by remember { mutableStateOf("") }

    fun send() {
        val t = text
        text = ""
        game.submit(t)
    }

    val chips = ArrayList<String>()
    if (game.conn == null) {
        for (i in game.scanList.indices) {
            chips.add("connect ${i + 1}")
        }
    }
    chips.addAll(
        listOf(
            "scan", "probe", "bypass", "exploit", "crack", "loot",
            "collect", "mission", "shop", "status", "help", "disconnect"
        )
    )

    Column(Modifier.fillMaxWidth().background(PANEL)) {
        Row(
            Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 6.dp, vertical = 6.dp)
        ) {
            for (c in chips) {
                Text(
                    c,
                    color = GREEN,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .padding(end = 6.dp)
                        .border(1.dp, GREEN_DIM, RoundedCornerShape(4.dp))
                        .clickable { game.submit(c) }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text(game.prompt(), color = GREEN, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
            BasicTextField(
                value = text,
                onValueChange = { text = it },
                singleLine = true,
                textStyle = TextStyle(color = Color.White, fontFamily = FontFamily.Monospace, fontSize = 15.sp),
                cursorBrush = SolidColor(GREEN),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { send() }),
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 4.dp)
            )
            Text(
                "ENTER",
                color = GREEN,
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                modifier = Modifier
                    .clickable { send() }
                    .padding(horizontal = 8.dp, vertical = 6.dp)
            )
        }
    }
}

// ======================= Мини-игра: подбор кода =======================

@Composable
fun CodeGame(m: Mini.Code, game: Game) {
    val d = m.device
    val n = d.codeLen
    val maxTries = 8 + n + game.crackLvl
    val secret = remember(m) { List(n) { Random.nextInt(10) } }
    val history = remember(m) { mutableStateListOf<String>() }
    var cur by remember(m) { mutableStateOf("") }

    fun press(k: String) {
        if (k == "<") {
            if (cur.isNotEmpty()) {
                cur = cur.dropLast(1)
            }
            return
        }
        if (k == "OK") {
            if (cur.length != n) return
            val g = cur.map { it - '0' }
            var bulls = 0
            val sc = IntArray(10)
            val gc = IntArray(10)
            for (i in 0 until n) {
                if (g[i] == secret[i]) {
                    bulls++
                } else {
                    sc[secret[i]]++
                    gc[g[i]]++
                }
            }
            var cows = 0
            for (x in 0..9) {
                cows += minOf(sc[x], gc[x])
            }
            history.add(cur + "   " + "●".repeat(bulls) + "○".repeat(cows))
            cur = ""
            val secretText = secret.joinToString("")
            if (bulls == n) {
                game.onCodeResult(true, secretText)
            } else if (history.size >= maxTries) {
                game.onCodeResult(false, secretText)
            }
            return
        }
        if (cur.length < n) {
            cur += k
        }
    }

    Column(Modifier.fillMaxSize().padding(12.dp)) {
        Text(
            "ВЗЛОМ ПАРОЛЯ: ${d.hostname}",
            color = GREEN,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
        Text(
            "Угадай $n-значный код.\n● цифра на своём месте\n○ цифра есть, но не на своём месте",
            color = Color(0xFFC8E6C9),
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
        Text(
            "Попытки: ${history.size}/$maxTries",
            color = AMBER,
            fontFamily = FontFamily.Monospace,
            fontSize = 14.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
        LazyColumn(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(vertical = 8.dp)
        ) {
            items(history) { h ->
                Text(h, color = Color.White, fontFamily = FontFamily.Monospace, fontSize = 20.sp)
            }
        }
        Text(
            cur.padEnd(n, '_').toCharArray().joinToString(" "),
            color = GREEN,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 30.sp,
            modifier = Modifier.padding(vertical = 8.dp)
        )
        val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "<", "0", "OK")
        for (row in keys.chunked(3)) {
            Row(Modifier.fillMaxWidth()) {
                for (k in row) {
                    Button(
                        onClick = { press(k) },
                        modifier = Modifier
                            .weight(1f)
                            .padding(3.dp)
                    ) {
                        Text(k, fontSize = 20.sp)
                    }
                }
            }
        }
        Button(
            onClick = { game.abortMini() },
            modifier = Modifier
                .fillMaxWidth()
                .padding(3.dp)
        ) {
            Text("Прервать")
        }
    }
}

// ======================= Мини-игра: обход фаервола =======================

@Composable
fun FirewallGame(m: Mini.Firewall, game: Game) {
    val d = m.device
    val fw = d.firewall
    val zoneW = (0.34f - fw * 0.03f + game.bypassLvl * 0.02f).coerceIn(0.08f, 0.45f)
    val need = 2 + fw / 2

    var hits by remember(m) { mutableIntStateOf(0) }
    var lives by remember(m) { mutableIntStateOf(3) }
    var zoneStart by remember(m) { mutableFloatStateOf(Random.nextFloat() * (1f - zoneW)) }
    var pos by remember(m) { mutableFloatStateOf(0f) }
    var dir by remember(m) { mutableFloatStateOf(1f) }

    LaunchedEffect(m) {
        var last = withFrameNanos { it }
        while (true) {
            val now = withFrameNanos { it }
            val dt = (now - last) / 1_000_000_000f
            last = now
            val speed = 0.8f + hits * 0.12f + fw * 0.08f
            var p = pos + dir * speed * dt
            if (p > 1f) {
                p = 1f
                dir = -1f
            } else if (p < 0f) {
                p = 0f
                dir = 1f
            }
            pos = p
        }
    }

    fun tap() {
        if (pos >= zoneStart && pos <= zoneStart + zoneW) {
            hits += 1
            if (hits >= need) {
                game.onFirewallResult(true)
            } else {
                zoneStart = Random.nextFloat() * (1f - zoneW)
            }
        } else {
            lives -= 1
            if (lives <= 0) {
                game.onFirewallResult(false)
            }
        }
    }

    Column(Modifier.fillMaxSize().padding(12.dp)) {
        Text(
            "ОБХОД ФАЕРВОЛА: ${d.hostname}",
            color = GREEN,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
        Text(
            "Жми ВЗЛОМ, когда красный маркер в зелёной зоне.\nМаркер ускоряется после каждого попадания.",
            color = Color(0xFFC8E6C9),
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
        Text(
            "Попадания: $hits/$need     Жизни: $lives",
            color = AMBER,
            fontFamily = FontFamily.Monospace,
            fontSize = 15.sp,
            modifier = Modifier.padding(vertical = 12.dp)
        )
        Canvas(
            Modifier
                .fillMaxWidth()
                .height(80.dp)
                .background(Color(0xFF0A1A0F))
        ) {
            val w = size.width
            val h = size.height
            drawRect(
                Color(0xFF1B8E3A),
                topLeft = Offset(zoneStart * w, 0f),
                size = Size(zoneW * w, h)
            )
            drawRect(
                RED,
                topLeft = Offset(pos * w - 5f, 0f),
                size = Size(10f, h)
            )
        }
        Box(Modifier.weight(1f))
        Button(
            onClick = { tap() },
            modifier = Modifier
                .fillMaxWidth()
                .height(110.dp)
                .padding(vertical = 6.dp)
        ) {
            Text("ВЗЛОМ", fontSize = 26.sp, fontWeight = FontWeight.Bold)
        }
        Button(
            onClick = { game.abortMini() },
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 3.dp)
        ) {
            Text("Прервать")
        }
    }
}

// ======================= Мини-игра: эксплойт (память) =======================

@Composable
fun SequenceGame(m: Mini.Sequence, game: Game) {
    val d = m.device
    val len = 3 + d.security / 4
    val seq = remember(m) { List(len) { Random.nextInt(4) } }
    var lit by remember(m) { mutableIntStateOf(-1) }
    var showing by remember(m) { mutableStateOf(true) }
    var step by remember(m) { mutableIntStateOf(0) }
    var lives by remember(m) { mutableIntStateOf(2) }
    var replay by remember(m) { mutableIntStateOf(0) }

    val bright = listOf(Color(0xFF00E676), Color(0xFFFF5252), Color(0xFF40C4FF), Color(0xFFFFD740))
    val dim = listOf(Color(0xFF0B3D20), Color(0xFF4A1A1A), Color(0xFF123B52), Color(0xFF4D4012))

    LaunchedEffect(m, replay) {
        showing = true
        step = 0
        lit = -1
        delay(700)
        for (s in seq) {
            lit = s
            delay(550)
            lit = -1
            delay(250)
        }
        showing = false
    }

    fun tap(i: Int) {
        if (showing) return
        if (seq[step] == i) {
            step += 1
            if (step >= len) {
                game.onSequenceResult(true)
            }
        } else {
            lives -= 1
            if (lives <= 0) {
                game.onSequenceResult(false)
            } else {
                replay += 1
            }
        }
    }

    Column(Modifier.fillMaxSize().padding(12.dp)) {
        Text(
            "ЭКСПЛОЙТ: ${d.hostname}",
            color = GREEN,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
        Text(
            "Запомни порядок вспышек и повтори его.\nОшибка снимает жизнь и повторяет показ.",
            color = Color(0xFFC8E6C9),
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
        Text(
            if (showing) "Смотри..." else "Повторяй: $step/$len     Жизни: $lives",
            color = AMBER,
            fontFamily = FontFamily.Monospace,
            fontSize = 15.sp,
            modifier = Modifier.padding(vertical = 12.dp)
        )
        for (rowIdx in 0..1) {
            Row(Modifier.fillMaxWidth().weight(1f)) {
                for (colIdx in 0..1) {
                    val i = rowIdx * 2 + colIdx
                    Box(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .padding(6.dp)
                            .background(if (lit == i) bright[i] else dim[i], RoundedCornerShape(12.dp))
                            .clickable { tap(i) }
                    )
                }
            }
        }
        Button(
            onClick = { game.abortMini() },
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp)
        ) {
            Text("Прервать")
        }
    }
}
