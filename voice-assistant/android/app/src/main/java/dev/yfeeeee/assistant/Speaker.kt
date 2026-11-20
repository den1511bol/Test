// Developer: @yfeeeee
package dev.yfeeeee.assistant

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class Speaker(private val context: Context) {
    private var tts: TextToSpeech? = null

    private suspend fun ready(): TextToSpeech {
        tts?.let { return it }
        return withContext(Dispatchers.Main) {
            suspendCancellableCoroutine<TextToSpeech> { cont ->
                tts = TextToSpeech(context) { status ->
                    val engine = tts
                    if (status == TextToSpeech.SUCCESS && engine != null) {
                        engine.language = Locale("ru", "RU")
                        cont.resume(engine)
                    } else {
                        tts = null
                        cont.resumeWithException(IllegalStateException("TTS не запустился: $status"))
                    }
                }
            }
        }
    }

    /** Говорит текст и возвращается, когда фраза закончилась (или через 30 секунд). */
    suspend fun speak(text: String) {
        if (text.isBlank()) return
        val engine = ready()
        withTimeoutOrNull(30_000) {
            suspendCancellableCoroutine<Unit> { cont ->
                val id = UUID.randomUUID().toString()
                engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {}

                    override fun onDone(utteranceId: String?) {
                        if (utteranceId == id && cont.isActive) cont.resume(Unit)
                    }

                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        if (utteranceId == id && cont.isActive) cont.resume(Unit)
                    }
                })
                cont.invokeOnCancellation { engine.stop() }
                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
            }
        }
    }

    fun shutdown() {
        tts?.shutdown()
        tts = null
    }
}
