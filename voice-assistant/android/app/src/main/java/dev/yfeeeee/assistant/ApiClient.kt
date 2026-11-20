// Developer: @yfeeeee
package dev.yfeeeee.assistant

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class ServerReply(
    val reply: String,
    val actions: List<JSONObject>,
    val confirmId: String?,
    val listenAgain: Boolean,
)

class ApiClient(private val settings: Settings) {

    suspend fun command(text: String): ServerReply =
        post("/command", JSONObject().put("text", text))

    suspend fun confirm(id: String, approve: Boolean): ServerReply =
        post("/confirm", JSONObject().put("id", id).put("approve", approve))

    private suspend fun post(path: String, body: JSONObject): ServerReply = withContext(Dispatchers.IO) {
        if (settings.serverUrl.isEmpty() || settings.token.isEmpty()) {
            throw IOException("Не заданы адрес сервера или токен")
        }
        val conn = URL(settings.serverUrl + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 10_000
            conn.readTimeout = 90_000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.setRequestProperty("Authorization", "Bearer ${settings.token}")
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IOException("HTTP $code: ${text.take(200)}")
            parse(text)
        } finally {
            conn.disconnect()
        }
    }

    private fun parse(text: String): ServerReply {
        val json = JSONObject(text)
        val array = json.optJSONArray("actions")
        val actions = buildList<JSONObject> {
            if (array != null) for (i in 0 until array.length()) add(array.getJSONObject(i))
        }
        return ServerReply(
            reply = json.optString("reply", ""),
            actions = actions,
            confirmId = json.optJSONObject("confirm")?.optString("id"),
            listenAgain = json.optBoolean("listen_again", false),
        )
    }
}
