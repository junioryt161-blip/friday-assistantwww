package com.friday.assistant

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.*
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.*

class FridayVoiceService : Service(), RecognitionListener, TextToSpeech.OnInitListener {

    companion object {
        var instance: FridayVoiceService? = null
        var reactContext: ReactApplicationContext? = null
        const val CHANNEL_ID = "FridayVoiceServiceChannel"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var isAwake = false
    private var isTtsSpeaking = false
    private val restartHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        instance = this

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Friday::WakeLock")
        wakeLock?.acquire(24 * 60 * 60 * 1000L)

        tts = TextToSpeech(this, this)
        createNotificationChannel()

        val notification = createNotification("Friday is listening for 'Friday'...")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(101, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(101, notification)
        }

        initSpeechRecognizer()
        initFloatingOverlay()
    }

    private fun initSpeechRecognizer() {
        restartHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
            speechRecognizer?.setRecognitionListener(this)
            startListeningLoop()
        }
    }

    private fun startListeningLoop() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_ADDITIONAL_LANGUAGES, arrayOf("hi-IN", "en-US"))
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        speechRecognizer?.startListening(intent)
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val text = matches?.firstOrNull() ?: ""
        emitEvent("onSpeechRecognized", text)
        processSpeechText(text.lowercase(Locale.ROOT))
        scheduleRestart(300)
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val text = matches?.firstOrNull()?.lowercase(Locale.ROOT) ?: ""
        emitEvent("onPartialSpeech", text)

        if (isTtsSpeaking && matchesWakeWord(text)) {
            tts?.stop()
            isTtsSpeaking = false
            triggerWakeActivation()
        }
    }

    private fun matchesWakeWord(input: String): Boolean {
        val wakeVariations = listOf("friday", "fryday", "fri day", "fraiday", "frieday", "phriday")
        return wakeVariations.any { input.contains(it) }
    }

    private fun processSpeechText(input: String) {
        if (!isAwake) {
            if (matchesWakeWord(input)) {
                triggerWakeActivation()
            }
        } else {
            emitEvent("onCommandReceived", input)
            setOverlayState("processing")
            isAwake = false
        }
    }

    private fun triggerWakeActivation() {
        isAwake = true
        setOverlayState("listening")
        speak("Yes Boss") {
            restartHandler.postDelayed({
                if (isAwake) {
                    isAwake = false
                    setOverlayState("idle")
                    speak("Going back to standby Boss.")
                }
            }, 8000)
        }
    }

    fun speak(text: String, onComplete: (() -> Unit)? = null) {
        setOverlayState("speaking")
        isTtsSpeaking = true
        val params = Bundle()
        val utteranceId = UUID.randomUUID().toString()
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) {
                isTtsSpeaking = false
                setOverlayState("idle")
                onComplete?.invoke()
            }
            override fun onError(id: String?) {
                isTtsSpeaking = false
                setOverlayState("idle")
            }
        })
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
    }

    override fun onError(error: Int) {
        scheduleRestart(800)
    }

    private fun scheduleRestart(delayMs: Long) {
        restartHandler.removeCallbacksAndMessages(null)
        restartHandler.postDelayed({
            try {
                startListeningLoop()
            } catch (e: Exception) {
                initSpeechRecognizer()
            }
        }, delayMs)
    }

    private fun initFloatingOverlay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(this)) return

        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        floatingView = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#00E5FF"))
            }
        }

        val layoutParams = WindowManager.LayoutParams(
            130, 130,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 100
            y = 250
        }

        floatingView?.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f

            override fun onTouch(v: View?, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = layoutParams.x
                        initialY = layoutParams.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        layoutParams.x = initialX + (event.rawX - initialTouchX).toInt()
                        layoutParams.y = initialY + (event.rawY - initialTouchY).toInt()
                        windowManager?.updateViewLayout(floatingView, layoutParams)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (Math.abs(event.rawX - initialTouchX) < 10 && Math.abs(event.rawY - initialTouchY) < 10) {
                            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(launchIntent)
                        }
                        return true
                    }
                }
                return false
            }
        })

        Handler(Looper.getMainLooper()).post {
            try {
                windowManager?.addView(floatingView, layoutParams)
            } catch (_: Exception) {}
        }
    }

    fun setOverlayState(state: String) {
        Handler(Looper.getMainLooper()).post {
            val drawable = floatingView?.background as? GradientDrawable ?: return@post
            when (state) {
                "listening" -> drawable.setColor(Color.parseColor("#00E676"))
                "speaking" -> drawable.setColor(Color.parseColor("#2979FF"))
                "processing" -> drawable.setColor(Color.parseColor("#FF9100"))
                else -> drawable.setColor(Color.parseColor("#00E5FF"))
            }
        }
    }

    private fun createNotification(status: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Friday Voice Assistant")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID, "Friday Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun emitEvent(eventName: String, data: String) {
        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, data)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale("en", "IN")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        speechRecognizer?.destroy()
        tts?.shutdown()
        if (floatingView != null) windowManager?.removeView(floatingView)
        wakeLock?.release()
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
}
