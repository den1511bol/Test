// Developer: @yfeeeee
package dev.yfeeeee.assistant

import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Небольшой журнал в памяти: показывается в приложении, чтобы его можно было скопировать при отладке. */
object LogBuffer {
    private val lines = ArrayDeque<String>()
    private val format = SimpleDateFormat("HH:mm:ss", Locale.US)

    @Volatile
    var listener: ((String) -> Unit)? = null

    fun add(message: String) {
        Log.d("Assistant", message)
        val snapshot = synchronized(this) {
            lines.addLast("${format.format(Date())} $message")
            while (lines.size > 200) lines.removeFirst()
            lines.joinToString("\n")
        }
        listener?.invoke(snapshot)
    }

    fun snapshot(): String = synchronized(this) { lines.joinToString("\n") }
}
