// HackSim - Developer: @yfeeeee
package com.yfeeeee.hacksim

import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

enum class Tone { NORMAL, OK, WARN, ERR, INFO, CMD }

class Line(val text: String, val tone: Tone)

sealed interface Mini {
    class Code(val device: Device) : Mini
    class Firewall(val device: Device) : Mini
    class Sequence(val device: Device) : Mini
    class Wires(val device: Device) : Mini
    class Whack(val device: Device) : Mini
}

class Game(private val prefs: SharedPreferences) {

    val lines = mutableStateListOf<Line>()
    val scanList = mutableStateListOf<Device>()

    var money by mutableLongStateOf(prefs.getLong("money", 250L))
    var rep by mutableIntStateOf(prefs.getInt("rep", 0))
    var crackLvl by mutableIntStateOf(prefs.getInt("crack", 0))
    var bypassLvl by mutableIntStateOf(prefs.getInt("bypass", 0))
    var stealthLvl by mutableIntStateOf(prefs.getInt("stealth", 0))
    var hackedCount by mutableIntStateOf(0)

    var conn by mutableStateOf<Device?>(null)
    var probed by mutableStateOf(false)
    var fwDown by mutableStateOf(false)
    var exploited by mutableStateOf(false)
    var cracked by mutableStateOf(false)
    var trace by mutableIntStateOf(0)
    var mini by mutableStateOf<Mini?>(null)

    private val hacked = HashSet<Int>()

    // ботнет: каждое взломанное устройство приносит пассивный доход
    private var botRate: Long = prefs.getLong("botRate", 0L)
    private var lastCollect: Long = prefs.getLong("lastCollect", System.currentTimeMillis())

    // контракт: взломать N устройств нужного типа ради бонуса
    private var missionKey: String = prefs.getString("mKey", "") ?: ""
    private var missionNeed: Int = prefs.getInt("mNeed", 0)
    private var missionDone: Int = prefs.getInt("mDone", 0)
    private var missionBonus: Long = prefs.getLong("mBonus", 0L)

    val level: Int get() = 1 + rep / 40

    fun isOwned(id: Int): Boolean = id in hacked

    init {
        val saved = prefs.getString("hacked", "") ?: ""
        for (s in saved.split(",")) {
            val v = s.toIntOrNull()
            if (v != null) hacked.add(v)
        }
        hackedCount = hacked.size
        if (missionKey.isEmpty()) newMission()
        banner()
    }

    // ---------- вывод ----------

    fun out(text: String, tone: Tone = Tone.NORMAL) {
        for (part in text.split("\n")) {
            lines.add(Line(part, tone))
        }
        while (lines.size > 600) {
            lines.removeAt(0)
        }
    }

    fun prompt(): String {
        val c = conn
        return if (c == null) "local> " else c.ip + "> "
    }

    private fun banner() {
        out("=== HACKSIM v1.0 ===", Tone.OK)
        out("Developer: @yfeeeee", Tone.INFO)
        out("В сети $WORLD_SIZE устройств. Начни с команды scan.", Tone.NORMAL)
        out("Список команд: help", Tone.NORMAL)
    }

    // ---------- сохранение ----------

    private fun save() {
        prefs.edit()
            .putLong("money", money)
            .putInt("rep", rep)
            .putInt("crack", crackLvl)
            .putInt("bypass", bypassLvl)
            .putInt("stealth", stealthLvl)
            .putString("hacked", hacked.joinToString(","))
            .putLong("botRate", botRate)
            .putLong("lastCollect", lastCollect)
            .putString("mKey", missionKey)
            .putInt("mNeed", missionNeed)
            .putInt("mDone", missionDone)
            .putLong("mBonus", missionBonus)
            .apply()
    }

    private fun resetAll() {
        hacked.clear()
        hackedCount = 0
        money = 250L
        rep = 0
        crackLvl = 0
        bypassLvl = 0
        stealthLvl = 0
        botRate = 0L
        lastCollect = System.currentTimeMillis()
        newMission()
        disconnect(false)
        scanList.clear()
        save()
        lines.clear()
        banner()
        out("Прогресс сброшен.", Tone.WARN)
    }

    // ---------- команды ----------

    fun submit(raw: String) {
        val input = raw.trim()
        if (input.isEmpty()) return
        if (mini != null) return
        out(prompt() + input, Tone.CMD)

        val parts = input.split(Regex("\\s+"))
        val cmd = parts[0].lowercase()
        val arg = parts.getOrNull(1)?.lowercase()

        when (cmd) {
            "help", "?" -> help()
            "scan" -> scan(arg)
            "connect", "c" -> connect(arg)
            "probe" -> probe()
            "bypass" -> bypass()
            "exploit" -> exploit()
            "crack" -> crack()
            "loot" -> loot()
            "collect" -> collect()
            "mission", "contract" -> showMission()
            "disconnect", "dc", "exit" -> disconnect(true)
            "shop" -> shop()
            "buy" -> buy(arg)
            "status", "stat" -> status()
            "devices" -> devices()
            "clear", "cls" -> lines.clear()
            "about" -> about()
            "reset" -> {
                if (arg == "confirm") {
                    resetAll()
                } else {
                    out("Это удалит весь прогресс. Подтверждение: reset confirm", Tone.WARN)
                }
            }
            else -> {
                if (cmd.toIntOrNull() != null) {
                    connect(cmd)
                } else {
                    out("Неизвестная команда: $cmd. Введите help", Tone.ERR)
                }
            }
        }
    }

    private fun help() {
        out(
            "Команды:\n" +
                " scan [тип]      поиск устройств в сети\n" +
                "                 типы: cam router tv printer iot nas web db atm corp bank gov\n" +
                " connect <n|ip>  подключиться (n - номер из scan)\n" +
                " probe           разведка цели\n" +
                " bypass          обход фаервола (мини-игра)\n" +
                " exploit         эксплойт (мини-игра), нужен при защите 5+\n" +
                " crack           взлом пароля (мини-игра)\n" +
                " loot            забрать добычу\n" +
                " collect         забрать доход ботнета\n" +
                " mission         текущий контракт\n" +
                " disconnect      отключиться\n" +
                " shop            магазин софта\n" +
                " buy <имя>       купить: crack, bypass, stealth\n" +
                " status          твоя статистика\n" +
                " devices         сколько устройств взломано\n" +
                " clear           очистить экран\n" +
                " about           об игре\n" +
                " reset confirm   стереть прогресс",
            Tone.NORMAL
        )
        out("Путь взлома: scan -> connect -> probe -> bypass -> (exploit) -> crack -> loot", Tone.INFO)
        out("Следи за TRACE: если дойдёт до 100%, тебя отследят и оштрафуют.", Tone.INFO)
        out("Остерегайся ловушек (honeypot): их можно заметить через probe.", Tone.INFO)
        out("Ботнет: каждое взломанное устройство приносит ~8% своей добычи в час (копится до 8 часов).", Tone.INFO)
    }

    private fun about() {
        out("HackSim - симулятор хакера.", Tone.OK)
        out("Разработчик: @yfeeeee", Tone.INFO)
        out("Все устройства и сети вымышленные.", Tone.NORMAL)
    }

    private fun status() {
        out("Деньги: ${cash(money)}   REP: $rep   Уровень: $level", Tone.INFO)
        out("До следующего уровня: ${40 - rep % 40} REP", Tone.NORMAL)
        out("Взломано устройств: $hackedCount из $WORLD_SIZE", Tone.NORMAL)
        out("Софт: брутфорс $crackLvl/10, обход FW $bypassLvl/10, стелс $stealthLvl/10", Tone.NORMAL)
        out("Ботнет: ~${cash(botRate * 8L / 100L)}/час, накоплено ${cash(pendingBot())}", Tone.NORMAL)
    }

    // ---------- ботнет и контракты ----------

    private fun pendingBot(): Long {
        val minutes = minOf(480L, (System.currentTimeMillis() - lastCollect) / 60000L)
        if (minutes <= 0L) return 0L
        return botRate * 8L * minutes / 6000L
    }

    private fun collect() {
        if (botRate == 0L) {
            out("Ботнета пока нет: каждое взломанное устройство начнёт работать на вас.", Tone.WARN)
            return
        }
        val p = pendingBot()
        if (p <= 0L) {
            out("Пока нечего собирать. Доход: ~${cash(botRate * 8L / 100L)}/час.", Tone.INFO)
            return
        }
        money += p
        lastCollect = System.currentTimeMillis()
        save()
        out("[+] Ботнет принёс ${cash(p)}", Tone.OK)
    }

    private fun newMission() {
        val options = DeviceType.values().filter { it.minLevel <= level }
        val t = options[kotlin.random.Random.nextInt(options.size)]
        missionKey = t.key
        missionNeed = 2 + kotlin.random.Random.nextInt(3)
        missionDone = 0
        missionBonus = maxOf(100L, t.baseReward.toLong() * missionNeed * 3L)
    }

    private fun showMission() {
        val t = DeviceType.values().firstOrNull { it.key == missionKey }
        if (t == null) {
            newMission()
            save()
            out("Контракт обновлён. Введите mission ещё раз.", Tone.INFO)
            return
        }
        out(
            "Контракт: взломать ${t.title} x$missionNeed (scan ${t.key}). " +
                "Готово $missionDone/$missionNeed. Бонус: ${cash(missionBonus)}",
            Tone.INFO
        )
    }

    private fun devices() {
        val percent = "%.2f".format(hackedCount * 100.0 / WORLD_SIZE)
        out("Взломано: $hackedCount из $WORLD_SIZE ($percent%)", Tone.INFO)
    }

    // ---------- сеть ----------

    private fun scan(arg: String?) {
        if (conn != null) {
            out("Сначала отключитесь: disconnect", Tone.WARN)
            return
        }
        var wanted: DeviceType? = null
        if (arg != null) {
            wanted = DeviceType.values().firstOrNull { it.key.startsWith(arg) }
            if (wanted == null) {
                out("Неизвестный тип: $arg. См. help", Tone.ERR)
                return
            }
        }

        val found = ArrayList<Device>()
        var tries = 0
        while (found.size < 8 && tries < 20000) {
            tries++
            val d = World.device(kotlin.random.Random.nextInt(WORLD_SIZE))
            if (wanted != null && d.type != wanted) continue
            if (found.any { it.id == d.id }) continue
            found.add(d)
        }

        scanList.clear()
        out("Сканирование сети... найдено: ${found.size}", Tone.INFO)
        for (i in found.indices) {
            val d = found[i]
            scanList.add(d)
            val locked = d.type.minLevel > level
            val lockText = if (locked) " [нужен LVL ${d.type.minLevel}]" else ""
            val ownText = if (d.id in hacked) " [ВЗЛОМАНО]" else ""
            out(
                "[${i + 1}] ${d.ip}  ${d.hostname}  ${d.type.title}  ${d.country}  защита ${d.security}$lockText$ownText",
                if (locked) Tone.WARN else Tone.NORMAL
            )
        }
        if (found.isNotEmpty()) out("Подключиться: connect <номер|ip>", Tone.INFO)
    }

    private fun connect(arg: String?) {
        if (arg == null) {
            out("Использование: connect <номер|ip>", Tone.WARN)
            return
        }
        val idx = arg.toIntOrNull()
        val d: Device? = if (idx != null) scanList.getOrNull(idx - 1) else World.byIp(arg)
        if (d == null) {
            out("Цель не найдена. Сначала сделайте scan.", Tone.ERR)
            return
        }
        if (d.type.minLevel > level) {
            out("Доступ запрещён: нужен уровень ${d.type.minLevel} (у вас $level).", Tone.ERR)
            return
        }
        if (conn != null) disconnect(false)
        conn = d
        probed = false
        fwDown = false
        exploited = false
        cracked = false
        trace = 0
        out("Подключение к ${d.ip} (${d.hostname})...", Tone.INFO)
        out("[+] Соединение установлено: ${d.type.title}, ${d.country}", Tone.OK)
        out("Дальше: probe", Tone.INFO)
    }

    private fun disconnect(message: Boolean) {
        if (conn == null) {
            if (message) out("Вы ни к чему не подключены.", Tone.WARN)
            return
        }
        conn = null
        probed = false
        fwDown = false
        exploited = false
        cracked = false
        trace = 0
        mini = null
        if (message) out("Соединение закрыто.", Tone.INFO)
    }

    private fun needConn(): Device? {
        val d = conn
        if (d == null) out("Нет подключения. Используйте scan и connect.", Tone.WARN)
        return d
    }

    private fun probe() {
        val d = needConn() ?: return
        out("Сканирование портов ${d.ip}...", Tone.INFO)
        out("ОС: ${d.os}", Tone.NORMAL)
        out("Открытые порты: ${d.ports.joinToString(", ")}", Tone.NORMAL)
        val fwText = if (d.firewall == 0) "нет" else "уровень ${d.firewall}"
        out("Фаервол: $fwText", Tone.NORMAL)
        out("Эксплойт-защита: ${if (d.needsExploit) "да" else "нет"}", Tone.NORMAL)
        out("Длина ключа: ${d.codeLen}", Tone.NORMAL)
        out("Защита: ${d.security}/10, ожидаемая добыча: ~${cash(d.reward)}", Tone.NORMAL)
        if (d.honeypot && d.id % 4 != 0) {
            out("[?] Подозрительно: система слишком чистая, живых пользователей нет. Похоже на ловушку!", Tone.WARN)
        }
        if (d.id in hacked) out("Внимание: устройство уже взломано вами. Добычи не будет.", Tone.WARN)
        probed = true
        out("Дальше: bypass", Tone.INFO)
        addTrace(4 + d.security * 2)
    }

    private fun bypass() {
        val d = needConn() ?: return
        if (!probed) {
            out("Сначала разведка: probe", Tone.WARN)
            return
        }
        if (fwDown) {
            out("Фаервол уже обойдён. Дальше: ${afterFw(d)}", Tone.INFO)
            return
        }
        if (d.firewall == 0) {
            fwDown = true
            out("[+] Фаервола нет, обход не нужен. Дальше: ${afterFw(d)}", Tone.OK)
            return
        }
        out("Запуск обхода фаервола...", Tone.INFO)
        // для разнообразия: то тайминг, то соединение проводов
        mini = if (kotlin.random.Random.nextBoolean()) Mini.Firewall(d) else Mini.Wires(d)
    }

    private fun afterFw(d: Device): String = if (d.needsExploit) "exploit" else "crack"

    private fun exploit() {
        val d = needConn() ?: return
        if (!fwDown) {
            out("Сначала обойдите фаервол: bypass", Tone.WARN)
            return
        }
        if (!d.needsExploit) {
            out("Для этой цели эксплойт не нужен. Дальше: crack", Tone.INFO)
            return
        }
        if (exploited) {
            out("Эксплойт уже применён. Дальше: crack", Tone.INFO)
            return
        }
        out("Запуск эксплойта...", Tone.INFO)
        // то игра на память, то охота за вирусами
        mini = if (kotlin.random.Random.nextBoolean()) Mini.Sequence(d) else Mini.Whack(d)
    }

    private fun crack() {
        val d = needConn() ?: return
        if (!fwDown) {
            out("Сначала обойдите фаервол: bypass", Tone.WARN)
            return
        }
        if (d.needsExploit && !exploited) {
            out("Цель защищена от брутфорса. Сначала: exploit", Tone.WARN)
            return
        }
        if (cracked) {
            out("Пароль уже взломан. Дальше: loot", Tone.INFO)
            return
        }
        out("Запуск подбора пароля...", Tone.INFO)
        mini = Mini.Code(d)
    }

    private fun loot() {
        val d = needConn() ?: return
        if (!cracked) {
            out("Сначала взломайте пароль: crack", Tone.WARN)
            return
        }
        if (d.honeypot) {
            out("[!] Это была ЛОВУШКА (honeypot)! Вас засекли.", Tone.ERR)
            caught()
            return
        }
        val before = level
        if (d.id in hacked) {
            out("[=] Здесь уже всё выкачано. Добыча: 0", Tone.WARN)
        } else {
            // сначала начисляем накопленный доход ботнета, потом увеличиваем ставку
            val pending = pendingBot()
            if (pending > 0L) {
                money += pending
                out("[+] Ботнет принёс ${cash(pending)}", Tone.INFO)
            }
            lastCollect = System.currentTimeMillis()
            botRate += d.reward

            hacked.add(d.id)
            hackedCount = hacked.size
            money += d.reward
            rep += d.repGain
            out("[+] Данные скачаны! +${cash(d.reward)}  +${d.repGain} REP", Tone.OK)
            if (d.type.key == missionKey) {
                missionDone += 1
                if (missionDone >= missionNeed) {
                    money += missionBonus
                    out("[*] Контракт выполнен! Бонус ${cash(missionBonus)}", Tone.OK)
                    newMission()
                    out("Новый контракт: введите mission", Tone.INFO)
                } else {
                    out("Контракт: $missionDone/$missionNeed", Tone.INFO)
                }
            }
            if (level > before) {
                out("*** НОВЫЙ УРОВЕНЬ: $level ***", Tone.OK)
                out("Открываются новые типы устройств.", Tone.INFO)
            }
        }
        save()
        disconnect(false)
        out("Соединение закрыто. Следы подчищены.", Tone.INFO)
    }

    // ---------- трассировка ----------

    private fun addTrace(base: Int) {
        val add = maxOf(2, base - stealthLvl)
        trace = minOf(100, trace + add)
        if (trace >= 100) {
            caught()
        } else {
            out("[трассировка: $trace%]", if (trace > 70) Tone.ERR else Tone.WARN)
        }
    }

    private fun caught() {
        val fine = minOf(money, maxOf(50L, money / 10))
        money -= fine
        out("!!! ВАС ОТСЛЕДИЛИ !!!", Tone.ERR)
        out("Штраф: ${cash(fine)}. Соединение разорвано.", Tone.ERR)
        mini = null
        disconnect(false)
        save()
    }

    // ---------- мини-игры ----------

    fun onFirewallResult(ok: Boolean) {
        val d = conn
        mini = null
        if (d == null) return
        if (ok) {
            fwDown = true
            out("[+] Фаервол обойдён. Дальше: ${afterFw(d)}", Tone.OK)
            addTrace(4 + d.security * 2)
        } else {
            out("[-] Фаервол заблокировал атаку.", Tone.ERR)
            addTrace(15 + d.security * 2)
        }
    }

    fun onSequenceResult(ok: Boolean) {
        val d = conn
        mini = null
        if (d == null) return
        if (ok) {
            exploited = true
            out("[+] Эксплойт сработал. Дальше: crack", Tone.OK)
            addTrace(4 + d.security * 2)
        } else {
            out("[-] Эксплойт провалился.", Tone.ERR)
            addTrace(15 + d.security * 2)
        }
    }

    fun onCodeResult(ok: Boolean, secret: String) {
        val d = conn
        mini = null
        if (d == null) return
        if (ok) {
            cracked = true
            out("[+] Пароль взломан! Дальше: loot", Tone.OK)
            addTrace(4 + d.security * 2)
        } else {
            out("[-] Подбор не удался. Код был: $secret. Система сменила пароль.", Tone.ERR)
            addTrace(15 + d.security * 2)
        }
    }

    fun abortMini() {
        val d = conn
        mini = null
        if (d == null) return
        out("Атака прервана.", Tone.WARN)
        addTrace(8)
    }

    // ---------- магазин ----------

    private fun costOf(nextLevel: Int): Long = 100L * nextLevel * nextLevel

    private fun shopLine(key: String, name: String, lvl: Int, desc: String) {
        val priceText = if (lvl >= 10) "MAX" else cash(costOf(lvl + 1))
        out("buy $key  -  $name [$lvl/10]  цена: $priceText\n      $desc", Tone.NORMAL)
    }

    private fun shop() {
        out("=== МАГАЗИН ===  у вас ${cash(money)}", Tone.INFO)
        shopLine("crack", "Брутфорсер", crackLvl, "+1 попытка при подборе пароля")
        shopLine("bypass", "Обход фаервола", bypassLvl, "шире зелёная зона в мини-игре")
        shopLine("stealth", "Прокси и VPN", stealthLvl, "трассировка растёт медленнее")
    }

    private fun buy(name: String?) {
        val cur: Int = when (name) {
            "crack" -> crackLvl
            "bypass" -> bypassLvl
            "stealth" -> stealthLvl
            else -> {
                out("Использование: buy <crack|bypass|stealth>", Tone.WARN)
                return
            }
        }
        if (cur >= 10) {
            out("Уже максимальный уровень.", Tone.INFO)
            return
        }
        val cost = costOf(cur + 1)
        if (money < cost) {
            out("Не хватает денег: нужно ${cash(cost)}, у вас ${cash(money)}.", Tone.ERR)
            return
        }
        money -= cost
        when (name) {
            "crack" -> crackLvl += 1
            "bypass" -> bypassLvl += 1
            else -> stealthLvl += 1
        }
        save()
        out("[+] Куплено! Уровень: ${cur + 1}/10. Осталось ${cash(money)}.", Tone.OK)
    }
}
