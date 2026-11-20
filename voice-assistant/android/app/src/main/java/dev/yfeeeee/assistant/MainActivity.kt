// Developer: @yfeeeee
package dev.yfeeeee.assistant

import android.Manifest
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings as AndroidSettings
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/** Простой экран настройки без XML: адрес сервера, токен, разрешения, запуск/остановка, журнал. */
class MainActivity : Activity() {

    private lateinit var settings: Settings
    private lateinit var urlField: EditText
    private lateinit var tokenField: EditText
    private lateinit var thresholdField: EditText
    private lateinit var geminiBox: CheckBox
    private lateinit var statusView: TextView
    private lateinit var logView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = Settings(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }

        statusView = TextView(this).apply { textSize = 16f }
        root.addView(statusView)

        urlField = field("Адрес сервера, например https://xxx.up.railway.app", settings.serverUrl)
        tokenField = field("Токен (ASSISTANT_TOKEN)", settings.token).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        thresholdField = field("Порог активации 0.1–0.99 (по умолчанию 0.5)", settings.threshold.toString()).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        }
        root.addView(urlField)
        root.addView(tokenField)
        root.addView(thresholdField)
        geminiBox = CheckBox(this).apply {
            text = "Режим Gemini: после слова-активатора открывать голосовой ассистент телефона (сервер не нужен)"
            isChecked = settings.geminiMode
        }
        root.addView(geminiBox)

        root.addView(button("1. Выдать разрешения (микрофон, уведомления)") { requestRuntimePermissions() })
        root.addView(button("2. Разрешить «Поверх других окон»") { requestOverlay() })
        root.addView(button("3. Отключить оптимизацию батареи") { requestBatteryExemption() })
        root.addView(button("Сохранить и запустить") { saveAndStart() })
        root.addView(button("Остановить") {
            stopService(Intent(this, AssistantService::class.java))
            refreshStatus()
        })
        root.addView(button("Скопировать журнал") {
            val clipboard = getSystemService(ClipboardManager::class.java)
            clipboard.setPrimaryClip(ClipData.newPlainText("log", LogBuffer.snapshot()))
            Toast.makeText(this, "Журнал скопирован", Toast.LENGTH_SHORT).show()
        })

        logView = TextView(this).apply {
            textSize = 12f
            setTextIsSelectable(true)
            setPadding(0, dp(12), 0, 0)
        }
        root.addView(logView)

        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() {
        super.onResume()
        LogBuffer.listener = { text -> runOnUiThread { logView.text = text } }
        logView.text = LogBuffer.snapshot()
        refreshStatus()
    }

    override fun onPause() {
        LogBuffer.listener = null
        super.onPause()
    }

    private fun saveAndStart() {
        settings.serverUrl = urlField.text.toString()
        settings.token = tokenField.text.toString()
        val threshold = thresholdField.text.toString().toFloatOrNull()
        if (threshold != null && threshold in 0.05f..0.99f) settings.threshold = threshold
        settings.geminiMode = geminiBox.isChecked

        if (!settings.geminiMode) {
            if (!settings.serverUrl.startsWith("https://")) {
                toast("Адрес сервера должен начинаться с https://")
                return
            }
            if (settings.token.isEmpty()) {
                toast("Введите токен")
                return
            }
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            toast("Сначала выдайте разрешение на микрофон (кнопка 1)")
            return
        }
        startForegroundService(Intent(this, AssistantService::class.java))
        statusView.postDelayed({ refreshStatus() }, 500)
    }

    private fun requestRuntimePermissions() {
        val permissions = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        requestPermissions(permissions.toTypedArray(), 1)
    }

    private fun requestOverlay() {
        if (AndroidSettings.canDrawOverlays(this)) {
            toast("Уже разрешено")
            return
        }
        startActivity(
            Intent(AndroidSettings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")),
        )
    }

    private fun requestBatteryExemption() {
        startActivity(
            Intent(
                AndroidSettings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:$packageName"),
            ),
        )
    }

    private fun refreshStatus() {
        statusView.text = if (AssistantService.running) "Статус: работает" else "Статус: остановлен"
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun field(hint: String, value: String) = EditText(this).apply {
        this.hint = hint
        setText(value)
        setSingleLine()
    }

    private fun button(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        setOnClickListener { _: View -> onClick() }
    }
}
