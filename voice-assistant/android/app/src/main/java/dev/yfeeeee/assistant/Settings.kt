// Developer: @yfeeeee
package dev.yfeeeee.assistant

import android.content.Context

class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("assistant", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("url", "") ?: ""
        set(value) = prefs.edit().putString("url", value.trim().trimEnd('/')).apply()

    var token: String
        get() = prefs.getString("token", "") ?: ""
        set(value) = prefs.edit().putString("token", value.trim()).apply()

    /** Порог срабатывания слова-активатора (0..1). Меньше — чувствительнее, но больше ложных. */
    var threshold: Float
        get() = prefs.getFloat("threshold", 0.5f)
        set(value) = prefs.edit().putFloat("threshold", value).apply()

    /** Режим «Ифи → Gemini»: после слова-активатора открывается голосовой ассистент телефона. */
    var geminiMode: Boolean
        get() = prefs.getBoolean("gemini", false)
        set(value) = prefs.edit().putBoolean("gemini", value).apply()
}
