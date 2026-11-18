// HackSim - Developer: @yfeeeee
package com.yfeeeee.hacksim

import kotlin.random.Random

/** Сколько устройств в мире. Каждое генерируется по номеру (seed), в памяти не хранится. */
const val WORLD_SIZE = 50_000

fun cash(v: Long): String = "$v\$"

enum class DeviceType(
    val key: String,
    val title: String,
    val minLevel: Int,
    val secMin: Int,
    val secMax: Int,
    val baseReward: Int,
    val weight: Int,
    val brands: List<String>
) {
    CAMERA("cam", "IP-камера", 1, 1, 3, 30, 24, listOf("Hikvision", "Dahua", "Axis", "Reolink", "Foscam")),
    ROUTER("router", "Роутер", 1, 1, 4, 45, 20, listOf("TP-Link", "D-Link", "Asus", "Tenda", "Zyxel")),
    TV("tv", "Смарт-ТВ", 1, 1, 3, 35, 14, listOf("Samsung-TV", "LG-WebOS", "Sony-Bravia", "Philips-TV")),
    PRINTER("printer", "Принтер", 1, 1, 4, 40, 12, listOf("HP-Laser", "Canon-Pixma", "Epson-WF", "Brother-HL")),
    IOT("iot", "Умный дом", 1, 2, 5, 60, 12, listOf("SmartHub", "HomeKit-GW", "Zigbee-Bridge", "Nest-Hub")),
    NAS("nas", "NAS-хранилище", 2, 3, 6, 120, 10, listOf("Synology", "QNAP", "WD-Cloud", "Asustor")),
    WEB("web", "Веб-сервер", 3, 4, 7, 220, 9, listOf("nginx-srv", "apache-node", "shop-front", "blog-host")),
    DB("db", "База данных", 4, 5, 8, 450, 6, listOf("pg-cluster", "mysql-prod", "mongo-rs", "oracle-db")),
    ATM("atm", "Банкомат", 5, 6, 9, 900, 4, listOf("NCR-ATM", "Diebold", "Wincor", "Hyosung")),
    CORP("corp", "Корп. сервер", 6, 6, 9, 1200, 4, listOf("corp-dc", "erp-core", "hr-vault", "mail-gw")),
    BANK("bank", "Банк. сервер", 8, 8, 10, 3000, 2, listOf("swift-gw", "core-bank", "vault-x", "clearing-hub")),
    GOV("gov", "Гос. сервер", 10, 9, 10, 6000, 1, listOf("registry-01", "census-db", "defense-net", "archive-top"))
}

class Device(
    val id: Int,
    val ip: String,
    val hostname: String,
    val type: DeviceType,
    val country: String,
    val os: String,
    val security: Int,
    val firewall: Int,
    val codeLen: Int,
    val ports: List<String>,
    val reward: Long,
    val honeypot: Boolean
) {
    val repGain: Int get() = security * 3 + type.minLevel

    /** Устройства с защитой 5+ требуют ещё и эксплойт (мини-игра на память). */
    val needsExploit: Boolean get() = security >= 5
}

object World {
    private val countries = listOf(
        "US", "RU", "DE", "CN", "BR", "IN", "JP", "FR", "GB", "KR",
        "UA", "PL", "TR", "IT", "ES", "NL", "CA", "AU", "SE", "MX"
    )
    private val systems = listOf(
        "Linux 3.10", "Linux 4.9", "BusyBox 1.2", "Windows Server 2012",
        "Windows 7 Embedded", "FreeBSD 11", "VxWorks", "Android 6"
    )
    private val portPool = listOf(
        "21/ftp", "22/ssh", "23/telnet", "80/http", "443/https",
        "445/smb", "554/rtsp", "3306/mysql", "5900/vnc", "8080/http-alt"
    )
    private val totalWeight = DeviceType.values().sumOf { it.weight }

    fun ipOf(id: Int): String {
        val r = id % 200
        val q = id / 200
        return "${11 + r}.$q.${(id * 7919) % 256}.${(id * 37) % 254 + 1}"
    }

    /** Находит устройство по IP. Если такого адреса нет в мире, вернёт null. */
    fun byIp(text: String): Device? {
        val p = text.trim().split(".")
        if (p.size != 4) return null
        val n = IntArray(4)
        for (i in 0 until 4) {
            n[i] = p[i].toIntOrNull() ?: return null
        }
        val r = n[0] - 11
        val q = n[1]
        if (r < 0 || r > 199 || q < 0) return null
        val id = q * 200 + r
        if (id >= WORLD_SIZE) return null
        if (ipOf(id) != "${n[0]}.${n[1]}.${n[2]}.${n[3]}") return null
        return device(id)
    }

    fun device(id: Int): Device {
        val rnd = Random(id.toLong() * 7919L + 1337L)

        var roll = rnd.nextInt(totalWeight)
        var type = DeviceType.CAMERA
        for (t in DeviceType.values()) {
            if (roll < t.weight) {
                type = t
                break
            }
            roll -= t.weight
        }

        val security = rnd.nextInt(type.secMin, type.secMax + 1)
        val firewall = if (security <= 1) 0 else (security + 1) / 2
        val codeLen = 3 + (security - 1) / 3
        val brand = type.brands[rnd.nextInt(type.brands.size)]
        val hostname = "$brand-${rnd.nextInt(1000, 9999)}"
        val ports = portPool.shuffled(rnd)
            .take(2 + rnd.nextInt(3))
            .sortedBy { it.substringBefore('/').toInt() }
        val reward = (type.baseReward * (0.6 + security * 0.5) * (0.8 + rnd.nextDouble() * 0.4)).toLong()
        val honeypot = security >= 3 && rnd.nextInt(100) < 7

        return Device(
            id = id,
            ip = ipOf(id),
            hostname = hostname,
            type = type,
            country = countries[rnd.nextInt(countries.size)],
            os = systems[rnd.nextInt(systems.size)],
            security = security,
            firewall = firewall,
            codeLen = codeLen,
            ports = ports,
            reward = reward,
            honeypot = honeypot
        )
    }
}
