
package com.jirhost.reelrift;

import android.app.Activity;
import android.os.Bundle;
import android.os.Message;
import android.os.SystemClock;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView webView;
    private WebView popupWebView;
    private FrameLayout root;
    private View customView;
    private FrameLayout fullScreenContainer;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private long lastBackPressed = 0;

    // Remove blue tap highlight from website
    private WebViewClient createWebViewClient() {
        return new WebViewClient() {

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);

                String css =
                    "* { -webkit-tap-highlight-color: transparent !important; }" +
                    "html, body { -webkit-tap-highlight-color: transparent !important; }" +
                    "a, button, input, textarea, select, img {" +
                    "-webkit-tap-highlight-color: transparent !important;" +
                    "}";

                String javascript =
                    "(function() {" +
                    "var style = document.getElementById('reelrift-tap-style');" +
                    "if (!style) {" +
                    "style = document.createElement('style');" +
                    "style.id = 'reelrift-tap-style';" +
                    "style.type = 'text/css';" +
                    "style.appendChild(document.createTextNode(" +
                    "'" + css + "'" +
                    "));" +
                    "(document.head || document.documentElement).appendChild(style);" +
                    "}" +
                    "})();";

                view.evaluateJavascript(javascript, null);
            }
        };
    }

    private void setImmersiveMode() {
        Window window = getWindow();

        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);

        if (android.os.Build.VERSION.SDK_INT >= 29) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }

        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller =
                    window.getInsetsController();

            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());

                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );

                controller.setSystemBarsAppearance(
                    0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                );
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    private void restoreSystemBars() {
        Window window = getWindow();

        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);

        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller =
                    window.getInsetsController();

            if (controller != null) {
                controller.show(WindowInsets.Type.systemBars());
            }
        }

        getWindow().getDecorView().setSystemUiVisibility(0);
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        view.setBackgroundColor(0xFF07070A);
        view.setWebViewClient(createWebViewClient());
    }

    private void exitFullscreen() {
        if (customView == null) return;

        if (fullScreenContainer != null) {
            fullScreenContainer.removeView(customView);
        }

        customView = null;
        fullScreenContainer = null;

        setContentView(root);
        restoreSystemBars();

        WebChromeClient.CustomViewCallback callback =
                customViewCallback;

        customViewCallback = null;

        if (callback != null) {
            callback.onCustomViewHidden();
        }
    }

    private WebChromeClient createChromeClient() {
        return new WebChromeClient() {

            @Override
            public void onShowCustomView(
                    View view,
                    CustomViewCallback callback
            ) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }

                customView = view;
                customViewCallback = callback;

                fullScreenContainer = new FrameLayout(MainActivity.this);
                fullScreenContainer.setBackgroundColor(Color.BLACK);

                fullScreenContainer.addView(
                    view,
                    new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                );

                setContentView(fullScreenContainer);
                setImmersiveMode();
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }

            @Override
            public boolean onCreateWindow(
                    WebView view,
                    boolean isDialog,
                    boolean isUserGesture,
                    Message resultMsg
            ) {
                if (popupWebView != null) {
                    closePopup();
                }

                popupWebView = new WebView(MainActivity.this);

                configureWebView(popupWebView);
                popupWebView.setWebChromeClient(createChromeClient());

                root.addView(
                    popupWebView,
                    new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                );

                WebView.WebViewTransport transport =
                        (WebView.WebViewTransport) resultMsg.obj;

                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();

                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                if (window == popupWebView) {
                    closePopup();
                }
            }
        };
    }

    private void closePopup() {
        if (popupWebView == null) return;

        root.removeView(popupWebView);
        popupWebView.stopLoading();
        popupWebView.destroy();
        popupWebView = null;

        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        root = new FrameLayout(this);

        webView = new WebView(this);
        configureWebView(webView);
        webView.setWebChromeClient(createChromeClient());

        root.addView(
            webView,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );

        setContentView(root);

        // Live ReelRift website
        webView.loadUrl("https://reelrift-lake.vercel.app/");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);

        if (hasFocus && customView != null) {
            setImmersiveMode();
        }
    }

    @Override
    public void onBackPressed() {

        if (customView != null) {
            exitFullscreen();

        } else if (popupWebView != null) {
            closePopup();

        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();

        } else {
            long currentTime = SystemClock.elapsedRealtime();

            if (currentTime - lastBackPressed < 2000) {
                super.onBackPressed();
            } else {
                lastBackPressed = currentTime;

                Toast.makeText(
                    this,
                    "Press Back again to exit ReelRift",
                    Toast.LENGTH_SHORT
                ).show();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (webView != null) webView.onResume();
        if (popupWebView != null) popupWebView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        if (popupWebView != null) popupWebView.onPause();

        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (popupWebView != null) {
            popupWebView.destroy();
            popupWebView = null;
        }

        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
    }
                    
