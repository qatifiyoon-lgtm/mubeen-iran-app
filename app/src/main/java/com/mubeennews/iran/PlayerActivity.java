package com.mubeennews.iran;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.ui.PlayerView;

import java.util.HashMap;
import java.util.Map;

public class PlayerActivity extends Activity {

    private static final String UA =
            "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";

    private ExoPlayer player;
    private PlayerView view;
    private ProgressBar spinner;
    private TextView status;
    private String url;
    private int retries = 0;
    private final Handler h = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        url = getIntent().getStringExtra("url");
        String title = getIntent().getStringExtra("title");
        boolean audio = getIntent().getBooleanExtra("audio", false);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        view = new PlayerView(this);
        view.setKeepScreenOn(true);
        if (audio) view.setUseController(false);
        root.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        if (audio) {
            LinearLayout box = new LinearLayout(this);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setGravity(Gravity.CENTER);
            box.setBackgroundColor(Color.parseColor("#0B0B0B"));
            ImageView mark = new ImageView(this);
            mark.setImageResource(R.drawable.ic_flame_fg);
            int s = (int) (220 * getResources().getDisplayMetrics().density);
            box.addView(mark, new LinearLayout.LayoutParams(s, s));
            TextView t = new TextView(this);
            t.setText(title);
            t.setTextColor(Color.WHITE);
            t.setTextSize(30);
            t.setTypeface(Typeface.DEFAULT_BOLD);
            t.setGravity(Gravity.CENTER);
            box.addView(t);
            TextView sub = new TextView(this);
            sub.setText("بث مباشر على مدار الساعة");
            sub.setTextColor(Color.parseColor("#FF7A00"));
            sub.setTextSize(16);
            sub.setGravity(Gravity.CENTER);
            box.addView(sub);
            root.addView(box, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }

        TextView top = new TextView(this);
        top.setText("●  " + title);
        top.setTextColor(Color.WHITE);
        top.setTextSize(16);
        top.setTypeface(Typeface.DEFAULT_BOLD);
        top.setPadding(32, 24, 32, 24);
        top.setBackgroundColor(Color.parseColor("#99000000"));
        root.addView(top, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.RIGHT));

        spinner = new ProgressBar(this);
        root.addView(spinner, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        status = new TextView(this);
        status.setTextColor(Color.parseColor("#FFB547"));
        status.setTextSize(14);
        status.setGravity(Gravity.CENTER);
        status.setPadding(40, 0, 40, 80);
        root.addView(status, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));

        root.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (player != null && !player.isPlaying()) { retries = 0; start(); }
            }
        });

        setContentView(root);
        buildPlayer();
        start();
    }

    private void buildPlayer() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Referer", "https://telewebion.ir/");
        headers.put("Origin", "https://telewebion.ir");

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(UA)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000)
                .setDefaultRequestProperties(headers);

        player = new ExoPlayer.Builder(this).build();
        view.setPlayer(player);
        player.setMediaSource(new HlsMediaSource.Factory(http)
                .setAllowChunklessPreparation(true)
                .createMediaSource(MediaItem.fromUri(Uri.parse(url))));

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_BUFFERING) spinner.setVisibility(View.VISIBLE);
                else if (state == Player.STATE_READY) {
                    spinner.setVisibility(View.GONE);
                    status.setText("");
                    retries = 0;
                } else if (state == Player.STATE_ENDED) retry("انتهى البث");
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                retry(describe(error));
            }
        });
    }

    private String describe(PlaybackException e) {
        Throwable c = e.getCause();
        if (c instanceof HttpDataSource.InvalidResponseCodeException) {
            int code = ((HttpDataSource.InvalidResponseCodeException) c).responseCode;
            if (code == 403 || code == 451)
                return "الخادم رفض الاتصال (" + code + ") — البث يعمل فقط من إنترنت إيراني، أوقف الـ VPN";
            return "خطأ من الخادم (" + code + ")";
        }
        if (e.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED
                || e.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT)
            return "تعذّر الوصول إلى خادم البث — تأكد من الإنترنت أو أوقف الـ VPN";
        return e.getErrorCodeName();
    }

    private void start() {
        spinner.setVisibility(View.VISIBLE);
        status.setText("جارٍ الاتصال بالبث…");
        if (player.getPlaybackState() == Player.STATE_IDLE || player.getPlayerError() != null) {
            player.seekToDefaultPosition();
            player.prepare();
        }
        player.setPlayWhenReady(true);
    }

    private void retry(String reason) {
        retries++;
        if (retries > 5) {
            spinner.setVisibility(View.GONE);
            status.setText("تعذّر تشغيل البث:\n" + reason + "\nاضغط على الشاشة لإعادة المحاولة.");
            return;
        }
        status.setText("إعادة الاتصال (" + retries + ")…\n" + reason);
        h.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!isFinishing() && player != null) start();
            }
        }, 3000);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) player.setPlayWhenReady(false);
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null) player.setPlayWhenReady(true);
    }

    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        if (player != null) { player.release(); player = null; }
        super.onDestroy();
    }
}
