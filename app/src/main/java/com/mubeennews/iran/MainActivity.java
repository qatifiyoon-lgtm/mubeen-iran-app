package com.mubeennews.iran;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.UiModeManager;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(6);
    private boolean tv = false;

    static boolean isTv(Context c) {
        try {
            UiModeManager m = (UiModeManager) c.getSystemService(Context.UI_MODE_SERVICE);
            if (m != null && m.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) return true;
            PackageManager pm = c.getPackageManager();
            return pm.hasSystemFeature("android.software.leanback")
                    || !pm.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        tv = isTv(this);
        setRequestedOrientation(tv ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                                   : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        web = new WebView(this);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setBackgroundColor(Color.parseColor("#0B0B0B"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:")) return false;
                openExternalUrl(url);
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return shouldOverrideUrlLoading(view, request.getUrl().toString());
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        web.loadUrl("file:///android_asset/index.html" + (tv ? "?tv=1" : ""));
        web.requestFocus();
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onBack ? window.onBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (!"true".equals(value)) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    // الجهات الوحيدة التي يحق للتطبيق جلب البيانات منها
    static final String[] ALLOWED_HOSTS = {
            "mubeennews.com", "qatifiyoon.com", "45.89.237.183", "t.me",
            "telewebion.ir", "mehrnews.com", "irna.ir", "tasnimnews.ir",
            "isna.ir", "mashreghnews.ir"
    };

    static boolean isAllowed(String address) {
        try {
            URL u = new URL(address);
            String p = u.getProtocol();
            if (!"https".equals(p) && !"http".equals(p)) return false;
            String h = u.getHost().toLowerCase();
            for (String a : ALLOWED_HOSTS) {
                if (h.equals(a) || h.endsWith("." + a)) return true;
            }
        } catch (Exception ignored) { }
        return false;
    }

    private void openExternalUrl(String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) { }
    }

    private void callback(final String id, final boolean ok, final String payload) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                if (web == null) return;
                web.evaluateJavascript("window.__nativeCb && window.__nativeCb('" + id + "'," + (ok ? "true" : "false") + ",'" + payload + "')", null);
            }
        });
    }

    static byte[] httpGet(String address) throws Exception {
        String current = address;
        for (int hop = 0; hop < 6; hop++) {
            if (!isAllowed(current)) throw new Exception("blocked host");
            HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 MubeenNews/1.0");
            c.setRequestProperty("Accept", "*/*");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new Exception("redirect without location");
                current = new URL(new URL(current), loc).toString();
                continue;
            }
            if (code != 200) {
                c.disconnect();
                throw new Exception("HTTP " + code);
            }
            InputStream in = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (out.size() > 8 * 1024 * 1024) break;
            }
            in.close();
            c.disconnect();
            return out.toByteArray();
        }
        throw new Exception("too many redirects");
    }

    public class Bridge {

        @JavascriptInterface
        public void fetch(final String id, final String url) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        byte[] data = httpGet(url);
                        callback(id, true, Base64.encodeToString(data, Base64.NO_WRAP));
                    } catch (Throwable e) {
                        String msg = String.valueOf(e.getMessage());
                        callback(id, false, Base64.encodeToString(msg.getBytes(), Base64.NO_WRAP));
                    }
                }
            });
        }

        @JavascriptInterface
        public void play(String url, String title, boolean audio) {
            Intent i = new Intent(MainActivity.this, PlayerActivity.class);
            i.putExtra("url", url);
            i.putExtra("title", title);
            i.putExtra("audio", audio);
            startActivity(i);
        }

        @JavascriptInterface
        public boolean isTv() {
            return tv;
        }

        @JavascriptInterface
        public void openExternal(String url) {
            openExternalUrl(url);
        }

        @JavascriptInterface
        public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            try {
                startActivity(Intent.createChooser(i, "مشاركة"));
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public boolean isOnline() {
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkInfo ni = cm.getActiveNetworkInfo();
                return ni != null && ni.isConnected();
            } catch (Exception e) {
                return true;
            }
        }
    }
}
