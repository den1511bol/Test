// Developer: @yfeeeee
package dev.yfeeeee.assistant

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.ToneGenerator
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException

/**
 * Foreground-сервис: слушает слово-активатор -> распознаёт команду -> сервер -> озвучка и действия.
 * Работает при выключенном экране за счёт foreground-сервиса с типом microphone и WakeLock.
 */
class AssistantService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var job: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private lateinit var settings: Settings
    private lateinit var api: ApiClient
    private lateinit var speech: SpeechListener
    private lateinit var speaker: Speaker
    private lateinit var executor: ActionExecutor

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        settings = Settings(this)
        api = ApiClient(settings)
        speech = SpeechListener(this)
        speaker = Speaker(this)
        executor = ActionExecutor(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            ServiceCompat.startForeground(
                this, NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
        } catch (e: SecurityException) {
            LogBuffer.add("Не удалось запустить сервис: ${e.message}")
            stopSelf()
            return START_NOT_STICKY
        }
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            LogBuffer.add("Нет разрешения на микрофон")
            stopSelf()
            return START_NOT_STICKY
        }
        if (job?.isActive != true) {
            acquireWakeLock()
            running = true
            job = scope.launch { mainLoop() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        job?.cancel()
        scope.cancel()
        wakeLock?.let { if (it.isHeld) it.release() }
        speaker.shutdown()
        LogBuffer.add("Помощник остановлен")
        super.onDestroy()
    }

    // ---- основной цикл ----

    private suspend fun mainLoop() {
        val detector = try {
            WakeWordDetector(this)
        } catch (e: Throwable) {
            LogBuffer.add("Не удалось загрузить модели: ${e.javaClass.simpleName}: ${e.message}")
            stopSelf()
            return
        }
        LogBuffer.add("Помощник запущен, жду слово-активатор")
        detector.use {
            while (currentCoroutineContext().isActive) {
                try {
                    waitForWakeWord(it)
                    LogBuffer.add("Слово-активатор услышано")
                    beep()
                    conversation()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    LogBuffer.add("Ошибка: ${e.javaClass.simpleName}: ${e.message}")
                    delay(2_000)
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun waitForWakeWord(detector: WakeWordDetector) = withContext(Dispatchers.IO) {
        val minBuffer = AudioRecord.getMinBufferSize(
            SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
        )
        val record = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBuffer, WakeWordDetector.CHUNK * 8),
        )
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            throw IllegalStateException("AudioRecord не инициализирован (микрофон занят?)")
        }
        detector.reset()
        val buffer = ShortArray(WakeWordDetector.CHUNK)
        record.startRecording()
        try {
            var lastLogged = 0L
            while (true) {
                ensureActive()
                var read = 0
                while (read < buffer.size) {
                    val n = record.read(buffer, read, buffer.size - read)
                    if (n < 0) throw IOException("AudioRecord.read вернул $n")
                    read += n
                }
                val score = detector.process(buffer)
                if (score >= settings.threshold) {
                    LogBuffer.add("Оценка активации: %.2f".format(score))
                    return@withContext
                }
                // Для подбора порога: показываем «почти сработало», не чаще раза в 2 секунды.
                val now = System.currentTimeMillis()
                if (score >= 0.2f && now - lastLogged > 2_000) {
                    lastLogged = now
                    LogBuffer.add("Почти: %.2f".format(score))
                }
            }
        } finally {
            record.stop()
            record.release()
        }
    }

    private suspend fun conversation() {
        var heard: String? = speech.listen()
        var turns = 0
        while (!heard.isNullOrBlank() && turns < MAX_TURNS) {
            turns++
            val reply = try {
                api.command(heard)
            } catch (e: IOException) {
                LogBuffer.add("Сервер недоступен: ${e.message}")
                speaker.speak("Нет связи с сервером.")
                return
            }
            speaker.speak(reply.reply)
            executor.run(reply.actions)

            val confirmId = reply.confirmId
            when {
                confirmId != null -> {
                    handleConfirmation(confirmId)
                    return
                }
                reply.listenAgain -> heard = speech.listen()
                else -> return
            }
        }
        if (heard.isNullOrBlank()) speaker.speak("Не расслышал.")
    }

    private suspend fun handleConfirmation(id: String) {
        for (attempt in 1..2) {
            val answer = parseYesNo(speech.listen())
            if (answer != null) {
                val result = try {
                    api.confirm(id, answer)
                } catch (e: IOException) {
                    LogBuffer.add("Сервер недоступен: ${e.message}")
                    speaker.speak("Нет связи с сервером.")
                    return
                }
                speaker.speak(result.reply)
                return
            }
            if (attempt == 1) speaker.speak("Скажи да или нет.")
        }
        runCatching { api.confirm(id, false) }
        speaker.speak("Не расслышал ответ, сообщение не отправлено.")
    }

    private fun parseYesNo(text: String?): Boolean? {
        if (text.isNullOrBlank()) return null
        val words = text.lowercase().split(Regex("[^а-яёa-z]+")).filter { it.isNotEmpty() }
        // «Нет» проверяем первым: при любом сомнении сообщение не отправляется.
        if (words.any { it in NO_WORDS }) return false
        if (words.any { it in YES_WORDS }) return true
        return null
    }

    private suspend fun beep() {
        try {
            ToneGenerator(AudioManager.STREAM_MUSIC, 80).startTone(ToneGenerator.TONE_PROP_BEEP, 150)
        } catch (e: RuntimeException) {
            LogBuffer.add("Сигнал не воспроизведён: ${e.message}")
        }
        delay(250)
    }

    // ---- служебное ----

    private fun buildNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Голосовой помощник", NotificationManager.IMPORTANCE_LOW),
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Голосовой помощник")
            .setContentText("Слушаю слово-активатор")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "assistant:wake").apply { acquire() }
    }

    companion object {
        @Volatile
        var running = false
            private set

        private const val CHANNEL_ID = "assistant"
        private const val NOTIFICATION_ID = 1
        private const val SAMPLE_RATE = 16_000
        private const val MAX_TURNS = 3
        private val YES_WORDS = setOf(
            "да", "давай", "отправляй", "отправь", "ага", "угу", "подтверждаю", "конечно", "ок", "окей",
        )
        private val NO_WORDS = setOf("нет", "не", "отмена", "отменить", "стоп", "неа")
    }
}
