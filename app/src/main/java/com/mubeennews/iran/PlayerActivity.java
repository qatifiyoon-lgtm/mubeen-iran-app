package com.mubeennews.iran;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.MediaPlayer;
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
import android.widget.VideoView;

public class PlayerActivity extends Activity {

    private VideoView video;
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

        video = new VideoView(this);
        FrameLayout.LayoutParams vp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER);
        root.addView(video, vp);

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
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.RIGHT);
        root.addView(top, tp);

        spinner = new ProgressBar(this);
        root.addView(spinner, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        status = new TextView(this);
        status.setTextColor(Color.parseColor("#FFB547"));
        status.setTextSize(15);
        status.setGravity(Gravity.CENTER);
        status.setPadding(40, 0, 40, 60);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        root.addView(status, sp);

        setContentView(root);

        video.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer mp) {
                spinner.setVisibility(View.GONE);
                status.setText("");
                retries = 0;
                video.start();
            }
        });
        video.setOnInfoListener(new MediaPlayer.OnInfoListener() {
            @Override
            public boolean onInfo(MediaPlayer mp, int what, int extra) {
                if (what == MediaPlayer.MEDIA_INFO_BUFFERING_START) spinner.setVisibility(View.VISIBLE);
                if (what == MediaPlayer.MEDIA_INFO_BUFFERING_END || what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START)
                    spinner.setVisibility(View.GONE);
                return false;
            }
        });
        video.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mp, int what, int extra) {
                retry();
                return true;
            }
        });
        video.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                retry();
            }
        });
        root.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!video.isPlaying()) { retries = 0; start(); }
            }
        });

        start();
    }

    private void start() {
        spinner.setVisibility(View.VISIBLE);
        status.setText("جارٍ الاتصال بالبث…");
        video.setVideoURI(Uri.parse(url));
    }

    private void retry() {
        retries++;
        if (retries > 6) {
            spinner.setVisibility(View.GONE);
            status.setText("تعذّر تشغيل البث. تأكد من الاتصال ثم اضغط على الشاشة لإعادة المحاولة.");
            return;
        }
        status.setText("إعادة الاتصال… (" + retries + ")");
        h.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!isFinishing()) start();
            }
        }, 3000);
    }

    @Override
    protected void onPause() {
        super.onPause();
        video.pause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (url != null && !video.isPlaying() && retries == 0 && spinner.getVisibility() != View.VISIBLE) start();
    }

    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        video.stopPlayback();
        super.onDestroy();
    }
}
