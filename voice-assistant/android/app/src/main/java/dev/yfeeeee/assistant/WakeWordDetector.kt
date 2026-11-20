// Developer: @yfeeeee
package dev.yfeeeee.assistant

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.nio.FloatBuffer

/**
 * Порт потокового конвейера openWakeWord (https://github.com/dscripka/openWakeWord):
 * сырой звук 16 кГц -> mel-спектрограмма -> embedding (96) -> модель слова-активатора.
 *
 * Модели лежат в assets: melspectrogram.onnx, embedding_model.onnx, wakeword.onnx.
 * process() принимает ровно CHUNK (1280 = 80 мс) отсчётов PCM16 и возвращает оценку 0..1.
 */
class WakeWordDetector(context: Context) : AutoCloseable {

    private val env = OrtEnvironment.getEnvironment()
    private val options = OrtSession.SessionOptions().apply { setIntraOpNumThreads(1) }

    private val mel = load(context, "melspectrogram.onnx")
    private val embedding = load(context, "embedding_model.onnx")
    private val wake = load(context, "wakeword.onnx")

    private val raw = FloatArray(CHUNK + CONTEXT)
    private val melFrames = ArrayDeque<FloatArray>()
    private val embeddings = ArrayDeque<FloatArray>()
    private var processed = 0

    init {
        reset()
    }

    private fun load(context: Context, asset: String): OrtSession {
        val bytes = context.assets.open(asset).use { it.readBytes() }
        return env.createSession(bytes, options)
    }

    fun reset() {
        raw.fill(0f)
        melFrames.clear()
        repeat(EMBEDDING_WINDOW) { melFrames.addLast(FloatArray(MEL_BINS) { 1f }) }
        embeddings.clear()
        repeat(WAKE_FRAMES) { embeddings.addLast(FloatArray(EMBEDDING_DIM)) }
        processed = 0
    }

    fun process(chunk: ShortArray): Float {
        require(chunk.size == CHUNK) { "Нужно ровно $CHUNK отсчётов" }

        // Окно: хвост предыдущего чанка (контекст) + новый чанк.
        System.arraycopy(raw, CHUNK, raw, 0, CONTEXT)
        for (i in 0 until CHUNK) raw[CONTEXT + i] = chunk[i].toFloat()

        val melOut = run(mel, raw, longArrayOf(1, raw.size.toLong()))
        for (frame in 0 until melOut.size / MEL_BINS) {
            val values = FloatArray(MEL_BINS) { melOut[frame * MEL_BINS + it] / 10f + 2f }
            melFrames.addLast(values)
        }
        while (melFrames.size > MAX_MEL_FRAMES) melFrames.removeFirst()

        val window = FloatArray(EMBEDDING_WINDOW * MEL_BINS)
        val tail = melFrames.toList().takeLast(EMBEDDING_WINDOW)
        tail.forEachIndexed { i, frame -> frame.copyInto(window, i * MEL_BINS) }
        embeddings.addLast(run(embedding, window, longArrayOf(1, EMBEDDING_WINDOW.toLong(), MEL_BINS.toLong(), 1)))
        while (embeddings.size > MAX_EMBEDDINGS) embeddings.removeFirst()

        processed++
        if (processed < WARMUP_CHUNKS) return 0f

        val features = FloatArray(WAKE_FRAMES * EMBEDDING_DIM)
        embeddings.toList().takeLast(WAKE_FRAMES).forEachIndexed { i, e -> e.copyInto(features, i * EMBEDDING_DIM) }
        return run(wake, features, longArrayOf(1, WAKE_FRAMES.toLong(), EMBEDDING_DIM.toLong()))[0]
    }

    private fun run(session: OrtSession, data: FloatArray, shape: LongArray): FloatArray =
        OnnxTensor.createTensor(env, FloatBuffer.wrap(data), shape).use { input ->
            session.run(mapOf(session.inputNames.first() to input)).use { output ->
                val buffer = (output[0] as OnnxTensor).floatBuffer
                val result = FloatArray(buffer.remaining())
                buffer.get(result)
                result
            }
        }

    override fun close() {
        mel.close()
        embedding.close()
        wake.close()
        options.close()
    }

    companion object {
        const val CHUNK = 1280
        private const val CONTEXT = 480
        private const val MEL_BINS = 32
        private const val EMBEDDING_WINDOW = 76
        private const val EMBEDDING_DIM = 96
        private const val WAKE_FRAMES = 16
        private const val MAX_MEL_FRAMES = 970
        private const val MAX_EMBEDDINGS = 120

        // Пока буфер из 16 эмбеддингов не заполнен реальными данными (а не нулями), модель даёт
        // ложные срабатывания (~0.98 на шуме, проверено на alexa_v0.1). Ждём 16 чанков (~1.3 с).
        private const val WARMUP_CHUNKS = WAKE_FRAMES
    }
}
