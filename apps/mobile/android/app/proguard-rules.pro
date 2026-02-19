# Keep OkHttp classes referenced by uCrop.
-keep class okhttp3.** { *; }

# Keep flutter_inappwebview JavaScript bridge (used by cloudflare_turnstile)
-keep class com.pichillilorenzo.flutter_inappwebview.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Suppress missing android.window.BackEvent (flutter_inappwebview v6 beta)
-dontwarn android.window.BackEvent
