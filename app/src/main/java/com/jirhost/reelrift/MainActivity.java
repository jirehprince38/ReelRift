package com.jirhost.reelrift;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient.CustomViewCallback;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private WebView webView;
    private View customView;
    private FrameLayout fullScreenContainer;
    private CustomViewCallback customViewCallback;

    private void applyImmersiveMode() {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyImmersiveMode();

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF07070A);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                fullScreenContainer = new FrameLayout(MainActivity.this);
                fullScreenContainer.setBackgroundColor(0xFF000000);
                fullScreenContainer.addView(view,
                        new FrameLayout.LayoutParams(
                                FrameLayout.LayoutParams.MATCH_PARENT,
                                FrameLayout.LayoutParams.MATCH_PARENT));
                setContentView(fullScreenContainer);
                applyImmersiveMode();
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                if (fullScreenContainer != null) fullScreenContainer.removeView(customView);
                customView = null;
                fullScreenContainer = null;
                setContentView(webView);
                if (customViewCallback != null) customViewCallback.onCustomViewHidden();
                customViewCallback = null;
                applyImmersiveMode();
            }
        });

        setContentView(webView);
        webView.loadUrl("https://reelrift-lake.vercel.app/");
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            if (webView.getWebChromeClient() != null) {
                webView.evaluateJavascript(
                        "document.exitFullscreen && document.exitFullscreen()", null);
            }
            if (customViewCallback != null) customViewCallback.onCustomViewHidden();
            customView = null;
            setContentView(webView);
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveMode();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
