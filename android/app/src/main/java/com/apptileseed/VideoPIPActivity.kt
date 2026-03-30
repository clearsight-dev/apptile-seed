package com.apptileseed

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Rational
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

class VideoPIPActivity : AppCompatActivity() {
    companion object {
        private const val TAG = "VideoPIPActivity"
        const val EXTRA_VIDEO_URL = "video_url"
        const val EXTRA_SEEK_TO_MS = "seek_to_ms"
    }

    private var player: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var hasStopped: Boolean = false
    private var isFinishing: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video_pip)

        hasStopped = false
        isFinishing = false
        VideoPIPModule.setVideoPiPActivityInstance(this)
        Log.d(TAG, "onCreate - native ExoPlayer activity")

        playerView = findViewById(R.id.player_view)

        val videoUrl = intent.getStringExtra(EXTRA_VIDEO_URL)
            ?: "https://live.apptile.io/06ff4192-8d22-43a6-8663-36864deaa42d/playlist.m3u8"
        val seekToMs = intent.getLongExtra(EXTRA_SEEK_TO_MS, 0L)

        initializePlayer(videoUrl, seekToMs)

        // Enter PiP mode immediately
        Handler(Looper.getMainLooper()).postDelayed({
            enterPip()
        }, 300)
    }

    private fun initializePlayer(url: String, seekToMs: Long) {
        player = ExoPlayer.Builder(this).build().also { exoPlayer ->
            playerView?.player = exoPlayer
            val mediaItem = MediaItem.fromUri(Uri.parse(url))
            exoPlayer.setMediaItem(mediaItem)
            exoPlayer.repeatMode = Player.REPEAT_MODE_ONE
            exoPlayer.playWhenReady = true
            exoPlayer.prepare()
            if (seekToMs > 0) {
                exoPlayer.seekTo(seekToMs)
                Log.d(TAG, "Player seeking to ${seekToMs}ms")
            }
            Log.d(TAG, "Player initialized with URL: $url")
        }
    }

    private fun enterPip() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(9, 16))
                .build()
            enterPictureInPictureMode(params)
            Log.d(TAG, "Entered PiP mode")
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (!isInPictureInPictureMode && !isFinishing) {
            isFinishing = true
            Log.d(TAG, "Exiting PiP mode, preparing to finish")

            if (!hasStopped) {
                val pipModule = VideoPIPModule.getInstance()
                pipModule?.sendEvent("onVideoPipModeChanged", null)
            }

            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    Log.d(TAG, "Finishing VideoPIPActivity")
                    finish()
                } catch (e: Exception) {
                    Log.e(TAG, "Error finishing activity", e)
                }
            }, 150)
        }
    }

    override fun onStop() {
        hasStopped = true
        VideoPIPModule.setVideoPiPActivityInstance(null)
        super.onStop()
    }

    override fun onDestroy() {
        try {
            player?.release()
            player = null
            Log.d(TAG, "Player released")
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing player", e)
        }
        try {
            val pipModule = VideoPIPModule.getInstance()
            pipModule?.sendEvent("onVideoPipDismissed", null)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending onVideoPipDismissed event", e)
        }
        super.onDestroy()
    }
}
