package sa.urtv.home;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;

/**
 * The home screen's sky and cards (clock, dates, weather, prayer times, a row of hadith): dist/home.html in a
 * full-screen WebView behind the buttons and the favourites, which stay native and keep the remote's focus.
 * The page ships in the APK; every 6 hours the newest one is fetched from the repository, so the design can
 * change without a new APK. City and coordinates come from the screensaver's settings (ConfigProvider).
 */
final class HomePage {
    static final String URL_PAGE = "https://raw.githubusercontent.com/Bugami/AB_myTV/master/dist/home.html";
    private static final String FONTS = "https://raw.githubusercontent.com/Bugami/AB_myTV/master/assets/fonts/";
    private static final Uri CONFIG = Uri.parse("content://sa.urtv.screensaver.config");
    private static final long INTERVAL_MS = 6L * 3600 * 1000;
    static final int SKY = 0xFF0A1B66;   // the page's night colour, shown until it has painted

    private final Activity activity;
    private WebView web;
    private String loaded;

    HomePage(Activity activity) { this.activity = activity; }

    /** The WebView, or null when this TV has none (then the launcher keeps its photos). */
    @SuppressLint("SetJavaScriptEnabled")
    @SuppressWarnings("deprecation")
    View create() {
        try {
            web = new WebView(activity);
        } catch (RuntimeException e) {
            web = null;
            return null;
        }
        web.setBackgroundColor(SKY);
        web.setFocusable(false);
        web.setFocusableInTouchMode(false);
        web.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient() {
            // the page asks GitHub for its fonts; answer from the APK
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                String s = r.getUrl().toString();
                if (s.startsWith(FONTS)) {
                    String name = s.substring(FONTS.length());
                    if (name.matches("[A-Za-z0-9_-]+\\.woff2")) {
                        try {
                            return new WebResourceResponse("font/woff2", null, 200, "OK",
                                Collections.singletonMap("Access-Control-Allow-Origin", "*"),
                                activity.getAssets().open("fonts/" + name));
                        } catch (java.io.IOException ignored) { }
                    }
                }
                return super.shouldInterceptRequest(v, r);
            }
        });
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMediaPlaybackRequiresUserGesture(true);
        load(false);
        return web;
    }

    /** onResume: timers back on, the current settings, and a look for a newer page. */
    void resume() {
        if (web == null) return;
        web.onResume();
        web.resumeTimers();
        load(false);
        new Thread(() -> { if (checkUpdate()) activity.runOnUiThread(() -> load(true)); }).start();
    }

    /** onPause: no timers or network while an app is in front. */
    void pause() {
        if (web != null) { web.onPause(); web.pauseTimers(); }
    }

    void destroy() {
        if (web == null) return;
        ((ViewGroup) web.getParent()).removeView(web);
        web.destroy();
        web = null;
    }

    private File pageFile() { return new File(activity.getFilesDir(), "web/home.html"); }

    private void load(boolean changed) {
        if (web == null || activity.isDestroyed()) return;
        File f = pageFile();
        String base = f.isFile() ? Uri.fromFile(f).toString() : "file:///android_asset/web/home.html";
        String url = base + "#" + fragment();
        if (url.equals(loaded)) {
            if (changed) web.reload();   // same address, new file on disk
            return;
        }
        loaded = url;
        web.loadUrl(url);   // a new fragment alone reloads too: the page listens for hashchange
    }

    /** city, lat, lon and tz from the screensaver's settings; the page has Riyadh's when it is missing. */
    private String fragment() {
        try (Cursor c = activity.getContentResolver().query(CONFIG, null, null, null, null)) {
            if (c == null || !c.moveToFirst() || c.getString(0) == null) return "";
            return c.getString(0);
        } catch (RuntimeException e) {
            return "";
        }
    }

    /** Off the main thread. True when a newer, complete page was saved. */
    private synchronized boolean checkUpdate() {
        SharedPreferences sp = Dock.prefs(activity);
        long now = System.currentTimeMillis();
        if (now - sp.getLong("homePageCheck", 0) < INTERVAL_MS) return false;
        File out = pageFile();
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(URL_PAGE).openConnection();
            con.setConnectTimeout(15000);
            con.setReadTimeout(30000);
            String etag = sp.getString("homePageEtag", null);
            if (etag != null && out.isFile()) con.setRequestProperty("If-None-Match", etag);
            int code = con.getResponseCode();
            sp.edit().putLong("homePageCheck", now).apply();
            if (code != HttpURLConnection.HTTP_OK) return false;
            byte[] body = readAll(con.getInputStream());
            String text = new String(body, "UTF-8");
            // never swap in a truncated or wrong file
            if (body.length < 20_000 || !text.contains("<html") || !text.contains("</html>") || !text.contains("id=\"hrow\"")) return false;
            File dir = out.getParentFile();
            if (!dir.isDirectory() && !dir.mkdirs()) return false;
            File tmp = new File(dir, "home.tmp");
            try (FileOutputStream fo = new FileOutputStream(tmp)) { fo.write(body); }
            if (!tmp.renameTo(out)) return false;
            sp.edit().putString("homePageEtag", con.getHeaderField("ETag")).apply();
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = i.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        }
    }
}
