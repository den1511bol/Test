// Developer: @yfeeeee
package dev.yfeeeee.assistant

import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.AlarmClock
import android.provider.MediaStore
import org.json.JSONObject

/**
 * Выполняет действия, которые вернул сервер. Запуск activity из фонового сервиса
 * работает только при выданном разрешении «Поверх других окон» (см. MainActivity).
 */
class ActionExecutor(private val context: Context) {

    fun run(actions: List<JSONObject>) {
        for (action in actions) {
            try {
                when (val type = action.optString("type")) {
                    "play_music" -> playMusic(action.getString("query"))
                    "set_timer" -> setTimer(action.getInt("seconds"), action.optString("label"))
                    "set_alarm" -> setAlarm(
                        action.getInt("hour"), action.getInt("minute"), action.optString("label"),
                    )
                    else -> LogBuffer.add("Неизвестное действие: $type")
                }
            } catch (e: Exception) {
                LogBuffer.add("Действие не выполнено: ${e.javaClass.simpleName}: ${e.message}")
            }
        }
    }

    private fun playMusic(query: String) {
        LogBuffer.add("Музыка: $query")
        val play = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH).apply {
            setPackage(YT_MUSIC)
            putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*")
            putExtra(SearchManager.QUERY, query)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(play)
        } catch (e: ActivityNotFoundException) {
            // Запасной вариант: открыть поиск в YouTube Music (без автозапуска).
            val search = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://music.youtube.com/search?q=" + Uri.encode(query)),
            ).apply {
                setPackage(YT_MUSIC)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(search)
        }
    }

    private fun setTimer(seconds: Int, label: String) {
        LogBuffer.add("Таймер: $seconds с ($label)")
        val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
            putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            putExtra(AlarmClock.EXTRA_MESSAGE, label)
            putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun setAlarm(hour: Int, minute: Int, label: String) {
        LogBuffer.add("Будильник: %02d:%02d (%s)".format(hour, minute, label))
        val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minute)
            putExtra(AlarmClock.EXTRA_MESSAGE, label)
            putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private companion object {
        const val YT_MUSIC = "com.google.android.apps.youtube.music"
    }
}
