// HackSim - Developer: @yfeeeee
package com.yfeeeee.hacksim

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {
    private lateinit var game: Game
    private var tone: ToneGenerator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        game = Game(getSharedPreferences("hacksim", Context.MODE_PRIVATE))
        tone = try {
            ToneGenerator(AudioManager.STREAM_MUSIC, 70)
        } catch (e: Exception) {
            null
        }
        game.fx = { kind -> playFx(kind) }
        setContent { HackApp(game) }
    }

    private fun playFx(kind: String) {
        try {
            when (kind) {
                "ok" -> {
                    tone?.startTone(ToneGenerator.TONE_PROP_ACK, 150)
                    buzz(40L)
                }
                "err" -> {
                    tone?.startTone(ToneGenerator.TONE_PROP_NACK, 250)
                    buzz(120L)
                }
                "alarm" -> {
                    tone?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 600)
                    buzz(400L)
                }
                "coin" -> {
                    tone?.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
                    buzz(60L)
                }
            }
        } catch (e: Exception) {
            // звук не критичен для игры
        }
    }

    private fun buzz(ms: Long) {
        val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (Build.VERSION.SDK_INT >= 26) {
            v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            v.vibrate(ms)
        }
    }

    override fun onDestroy() {
        tone?.release()
        super.onDestroy()
    }
}
