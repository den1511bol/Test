// Developer: @yfeeeee
package dev.yfeeeee.assistant

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

/** Распознавание речи через системный SpeechRecognizer (должен работать на главном потоке). */
class SpeechListener(private val context: Context) {

    /** Возвращает распознанный текст или null (тишина, ошибка, нет распознавателя). */
    suspend fun listen(): String? = withContext(Dispatchers.Main) {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            LogBuffer.add("SpeechRecognizer недоступен на этом устройстве")
            return@withContext null
        }
        suspendCancellableCoroutine<String?> { cont ->
            val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
            var finished = false

            fun finish(value: String?) {
                if (finished) return
                finished = true
                recognizer.destroy()
                if (cont.isActive) cont.resume(value)
            }

            recognizer.setRecognitionListener(object : RecognitionListener {
                override fun onResults(results: Bundle?) {
                    val text = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                    LogBuffer.add("Распознано: ${text ?: "<пусто>"}")
                    finish(text)
                }

                override fun onError(error: Int) {
                    LogBuffer.add("Ошибка распознавания: $error")
                    finish(null)
                }

                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            cont.invokeOnCancellation { if (!finished) { finished = true; recognizer.destroy() } }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            }
            recognizer.startListening(intent)
        }
    }
}
